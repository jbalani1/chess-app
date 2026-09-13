-- One entry point for the Mistake Explorer.
--
-- Everything the page needs — the rows, the facet counts, the phase x edge
-- breakdown and the recurring groups — comes back in a single call, so the
-- filter logic exists in exactly one place and the page is one round trip.
--
-- Filters arrive as JSONB so adding a facet does not change the signature.

DROP FUNCTION IF EXISTS explorer_query(JSONB);

-- Counting helper: reads the temp table the caller just built.
CREATE OR REPLACE FUNCTION facet_counts(col TEXT)
RETURNS JSONB AS $$
DECLARE out JSONB;
BEGIN
  EXECUTE format(
    'SELECT COALESCE(jsonb_agg(jsonb_build_object(''value'', v, ''count'', n)
             ORDER BY n DESC, v), ''[]''::jsonb)
     FROM (SELECT %I::text v, COUNT(*) n FROM _hits
           WHERE %I IS NOT NULL GROUP BY 1) t', col, col)
  INTO out;
  RETURN out;
END;
$$ LANGUAGE plpgsql;


CREATE OR REPLACE FUNCTION explorer_query(f JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB AS $$
DECLARE
  v_username  TEXT    := COALESCE(f->>'username', 'negrilmannings');
  v_limit     INT     := LEAST(COALESCE((f->>'limit')::int, 50), 500);
  v_offset    INT     := GREATEST(COALESCE((f->>'offset')::int, 0), 0);
  v_sort      TEXT    := COALESCE(f->>'sort', 'impact');
  v_last_games INT    := NULLIF(f->>'last_games', '')::int;
  v_last_days  INT    := NULLIF(f->>'last_days', '')::int;
  result      JSONB;
BEGIN
  -- Recency is resolved at the GAME level first. "Last 50 games" has to mean
  -- the 50 most recent games matching the game-level facets — if a move-level
  -- filter like phase could change which games qualify, the window would shift
  -- under the user every time they clicked a chip.
  DROP TABLE IF EXISTS _scope;
  CREATE TEMP TABLE _scope ON COMMIT DROP AS
  SELECT g.id, g.played_at
  FROM games g
  WHERE g.username = v_username
    AND (f->>'color'          IS NULL OR g.user_color     = f->>'color')
    AND (f->>'vs_first_move'  IS NULL OR g.vs_first_move  = f->>'vs_first_move')
    AND (f->>'user_reply'     IS NULL OR g.user_reply     = f->>'user_reply')
    AND (f->>'opening_family' IS NULL OR g.opening_family = f->>'opening_family')
    AND (f->>'eco'            IS NULL OR g.eco            = f->>'eco')
    AND (f->>'time_control'   IS NULL OR g.time_control   = f->>'time_control')
    AND (f->>'date_from'      IS NULL OR g.played_at >= (f->>'date_from')::timestamptz)
    AND (f->>'date_to'        IS NULL OR g.played_at <  ((f->>'date_to')::date + 1))
    AND (v_last_days          IS NULL OR g.played_at >= now() - make_interval(days => v_last_days))
  ORDER BY g.played_at DESC
  LIMIT COALESCE(v_last_games, 2147483647);

  -- Rows surviving every active filter. Each facet is applied only when the
  -- caller supplied it, so an empty filter object means "everything".
  DROP TABLE IF EXISTS _hits;
  CREATE TEMP TABLE _hits ON COMMIT DROP AS
  SELECT um.* FROM user_mistakes um
  JOIN _scope sc ON sc.id = um.game_id
  WHERE (f->>'phase'          IS NULL OR um.phase          = f->>'phase')
    AND (f->>'edge'           IS NULL OR um.edge_bucket    = f->>'edge')
    AND (f->>'classification' IS NULL OR um.classification = f->>'classification')
    AND (f->>'piece'          IS NULL OR um.piece_moved    = f->>'piece')
    AND (f->>'min_loss'       IS NULL OR um.avoidable_loss >= (f->>'min_loss')::int)
    AND (f->>'search'         IS NULL OR um.move_san ILIKE '%' || (f->>'search') || '%'
                                      OR um.opening_clean ILIKE '%' || (f->>'search') || '%');

  SELECT jsonb_build_object(
    'total', (SELECT COUNT(*) FROM _hits),

    'summary', (
      SELECT jsonb_build_object(
        'mistakes',   COUNT(*) FILTER (WHERE classification = 'mistake'),
        'blunders',   COUNT(*) FILTER (WHERE classification = 'blunder'),
        'games',      COUNT(DISTINCT game_id),
        'avg_cp_lost', COALESCE(ROUND(AVG(LEAST(cp_lost, 1000)))::int, 0),
        'material_drops', COUNT(*) FILTER (WHERE avoidable_loss >= 2),
        'pawns_dropped',  COALESCE(SUM(avoidable_loss) FILTER (WHERE avoidable_loss >= 2), 0),
        'from_winning',   COUNT(*) FILTER (WHERE edge_bucket IN ('winning','better')),
        'games_in_scope', (SELECT COUNT(*) FROM _scope),
        'clean_games',    (SELECT COUNT(*) FROM _scope s
                           WHERE NOT EXISTS (SELECT 1 FROM _hits h WHERE h.game_id = s.id)),
        'window_from',    (SELECT MIN(played_at)::date::text FROM _scope),
        'window_to',      (SELECT MAX(played_at)::date::text FROM _scope)
      ) FROM _hits
    ),

    -- Every facet is counted over the same filtered set, so the numbers on the
    -- chips always describe what a click would actually show.
    'facets', jsonb_build_object(
      'color',          (SELECT facet_counts('user_color')),
      'vs_first_move',  (SELECT facet_counts('vs_first_move')),
      'opening_family', (SELECT facet_counts('opening_family')),
      'phase',          (SELECT facet_counts('phase')),
      'edge',           (SELECT facet_counts('edge_bucket')),
      'classification', (SELECT facet_counts('classification')),
      'piece',          (SELECT facet_counts('piece_moved')),
      'time_control',   (SELECT facet_counts('time_control'))
    ),

    -- "what do I do in the opening vs the middlegame" crossed with
    -- "how good was my position when I did it"
    'breakdown', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
               'phase', phase, 'edge', edge_bucket, 'n', n,
               'avg_cp', avg_cp, 'drops', drops)), '[]'::jsonb)
      FROM (
        SELECT phase, edge_bucket, COUNT(*) n,
               ROUND(AVG(LEAST(cp_lost, 1000)))::int avg_cp,
               COUNT(*) FILTER (WHERE avoidable_loss >= 2) drops
        FROM _hits GROUP BY phase, edge_bucket
      ) b
    ),

    -- The same move played wrong more than once, which is what turns a list of
    -- errors into something you can actually train.
    'recurring', (
      SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
        SELECT jsonb_build_object(
                 'move_san', move_san,
                 'piece', piece_moved,
                 'n', COUNT(*),
                 'blunders', COUNT(*) FILTER (WHERE classification = 'blunder'),
                 'avg_cp', ROUND(AVG(LEAST(cp_lost, 1000)))::int,
                 'drops', COUNT(*) FILTER (WHERE avoidable_loss >= 2),
                 'first_move_no', MIN(move_number),
                 'last_move_no', MAX(move_number),
                 'phases', (SELECT jsonb_agg(DISTINCT p) FROM unnest(array_agg(phase)) p),
                 'edges', (SELECT jsonb_agg(DISTINCT e) FROM unnest(array_agg(edge_bucket)) e),
                 'better', (SELECT jsonb_agg(DISTINCT bm)
                            FROM unnest(array_agg(best_move_san)) bm WHERE bm IS NOT NULL),
                 'examples', (SELECT jsonb_agg(jsonb_build_object(
                                'game_id', gi, 'move_id', mi, 'ply', pl,
                                'url', u, 'move_no', mn, 'opponent', op,
                                'played_at', pa))
                              FROM (SELECT unnest(array_agg(game_id)) gi,
                                           unnest(array_agg(id)) mi,
                                           unnest(array_agg(ply)) pl,
                                           unnest(array_agg(game_url)) u,
                                           unnest(array_agg(move_number)) mn,
                                           unnest(array_agg(CASE WHEN user_color='white'
                                                  THEN black_player ELSE white_player END)) op,
                                           unnest(array_agg(played_at::date::text)) pa) ex)
               ) r
        FROM _hits
        GROUP BY move_san, piece_moved
        HAVING COUNT(*) >= 2
        ORDER BY COUNT(*) DESC, AVG(LEAST(cp_lost, 1000)) DESC
        LIMIT 40
      ) rr
    ),

    'rows', (
      SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.rn), '[]'::jsonb) FROM (
        SELECT h.*, ROW_NUMBER() OVER (
                 ORDER BY
                   -- Default: lead with concrete damage. Raw centipawn loss is
                   -- dominated by mate-score jumps, which bury the live
                   -- positions worth reviewing.
                   CASE WHEN v_sort = 'impact'    THEN h.avoidable_loss END DESC NULLS LAST,
                   CASE WHEN v_sort = 'impact'    THEN LEAST(h.cp_lost, 1000) END DESC NULLS LAST,
                   CASE WHEN v_sort = 'cp_lost'   THEN LEAST(h.cp_lost, 1000) END DESC NULLS LAST,
                   CASE WHEN v_sort = 'material'  THEN h.avoidable_loss END DESC NULLS LAST,
                   CASE WHEN v_sort = 'edge'      THEN h.eval_before_user END DESC NULLS LAST,
                   CASE WHEN v_sort = 'move_no'   THEN h.move_number END ASC,
                   CASE WHEN v_sort = 'date'      THEN h.played_at END DESC,
                   h.played_at DESC
               ) rn
        FROM _hits h
        ORDER BY rn
        LIMIT v_limit OFFSET v_offset
      ) x
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION explorer_query(JSONB) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION facet_counts(TEXT) TO anon, authenticated;
GRANT SELECT ON user_mistakes TO anon, authenticated;
