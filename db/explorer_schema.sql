-- Mistake Explorer support
--
-- Adds the facets the analysis work showed were missing, and fixes three
-- defects it surfaced:
--   * games.opening_name is 'Unknown' for recent games (the real name is in the
--     PGN's ECOUrl header) -> opening_clean / opening_family
--   * "which colour was I, and is this my move?" was recomputed in JS on every
--     request -> games.user_color / moves.is_user_move
--   * classification alone mislabels some mate-score moves as blunders even
--     though the evaluation improved -> moves.is_real_error
-- and adds the two dimensions that carry the most signal:
--   * moves.eval_before_user  — your edge going into the move (your POV)
--   * moves.avoidable_loss    — material the move gave away that another legal
--                               move would have saved (SEE-verified)

ALTER TABLE games
  ADD COLUMN IF NOT EXISTS user_color      VARCHAR(5),
  ADD COLUMN IF NOT EXISTS opening_clean   VARCHAR(200),
  ADD COLUMN IF NOT EXISTS opening_family  VARCHAR(120),
  ADD COLUMN IF NOT EXISTS vs_first_move   VARCHAR(10),
  ADD COLUMN IF NOT EXISTS user_reply      VARCHAR(10);

ALTER TABLE moves
  ADD COLUMN IF NOT EXISTS is_user_move      BOOLEAN,
  ADD COLUMN IF NOT EXISTS is_real_error     BOOLEAN,
  ADD COLUMN IF NOT EXISTS eval_before_user  INTEGER,
  ADD COLUMN IF NOT EXISTS avoidable_loss    SMALLINT;

CREATE INDEX IF NOT EXISTS idx_games_user_color     ON games(username, user_color);
CREATE INDEX IF NOT EXISTS idx_games_vs_first_move  ON games(username, vs_first_move);
CREATE INDEX IF NOT EXISTS idx_games_opening_family ON games(username, opening_family);

CREATE INDEX IF NOT EXISTS idx_moves_real_error
  ON moves(game_id, is_real_error) WHERE is_real_error;
CREATE INDEX IF NOT EXISTS idx_moves_eval_before_user ON moves(eval_before_user);
CREATE INDEX IF NOT EXISTS idx_moves_avoidable_loss
  ON moves(avoidable_loss) WHERE avoidable_loss > 0;

-- ---------------------------------------------------------------------------
-- Edge bucket: the single most predictive dimension in the analysis — most
-- errors are played from positions that were already winning.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION edge_bucket(cp INTEGER)
RETURNS TEXT AS $$
BEGIN
  IF cp IS NULL THEN RETURN 'unknown';
  ELSIF cp >  300 THEN RETURN 'winning';
  ELSIF cp >  100 THEN RETURN 'better';
  ELSIF cp >= -100 THEN RETURN 'equal';
  ELSIF cp >= -300 THEN RETURN 'worse';
  ELSE RETURN 'losing';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ---------------------------------------------------------------------------
-- One flat view the app queries. Keeping the filter logic in SQL means the API
-- can paginate and aggregate properly instead of fetching every mistake and
-- slicing it in JavaScript.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW user_mistakes AS
SELECT
  m.id,
  m.game_id,
  m.ply,
  (m.ply + 1) / 2                AS move_number,
  m.move_san,
  m.move_uci,
  m.best_move_san,
  m.piece_moved,
  m.phase::text                  AS phase,
  m.classification::text         AS classification,
  m.blunder_category::text       AS blunder_category,
  m.eval_before_user,
  edge_bucket(m.eval_before_user) AS edge_bucket,
  m.eval_delta,
  ABS(m.eval_delta)              AS cp_lost,
  m.avoidable_loss,
  m.position_fen_before,
  g.username,
  g.user_color,
  g.vs_first_move,
  g.user_reply,
  g.opening_clean,
  g.opening_family,
  g.eco,
  g.result,
  g.time_control,
  g.played_at,
  g.white_player,
  g.black_player,
  substring(g.pgn from '\[Link "([^"]+)"\]') AS game_url
FROM moves m
JOIN games g ON g.id = m.game_id
WHERE m.is_user_move AND m.is_real_error;

COMMENT ON VIEW user_mistakes IS
  'Your own mistakes and blunders only, excluding moves the pipeline mislabels '
  'as blunders when the evaluation actually improved.';
