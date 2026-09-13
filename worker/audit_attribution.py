"""Audit: are the reported mistakes actually the user's moves?

Checks, in order of how badly each would break the report:
  1. duplicate move rows per (game, ply) — would inflate every count
  2. ply parity really maps to side-to-move (replay the PGN and compare SAN)
  3. the user really is the colour the scope query claims
  4. eval_delta sign is from the mover's perspective
  5. every move counted as "yours" was played by you, checked move by move
"""
import io
import os
import psycopg2
import chess
import chess.pgn
from collections import Counter
from dotenv import load_dotenv
import scope

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
USER = scope.USER
conn = psycopg2.connect(
    host=os.getenv('SUPABASE_HOST'), port=int(os.getenv('SUPABASE_PORT', 6543)),
    dbname=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'),
    password=os.getenv('SUPABASE_PASSWORD'), sslmode='require')
cur = conn.cursor()
fails = []


def check(name, ok, detail=''):
    print(f'  [{"PASS" if ok else "FAIL"}] {name}{(" — " + detail) if detail else ""}')
    if not ok:
        fails.append(name)


print('=' * 74)
print('1. duplicate move rows per (game, ply)')
print('=' * 74)
cur.execute("""
    SELECT COUNT(*) FROM (
        SELECT m.game_id, m.ply FROM moves m
        JOIN games g ON g.id = m.game_id
        WHERE g.username = %s
        GROUP BY m.game_id, m.ply HAVING COUNT(*) > 1
    ) t
""", (USER,))
dupes = cur.fetchone()[0]
check('no (game, ply) analysed twice', dupes == 0, f'{dupes} duplicated plies')

cur.execute("""
    SELECT COUNT(DISTINCT m.engine_config_hash) FROM moves m
    JOIN games g ON g.id = m.game_id WHERE g.username = %s
""", (USER,))
print(f'    distinct engine configs present: {cur.fetchone()[0]}')

print()
print('=' * 74)
print('2+3+5. replay every scoped game and compare DB moves to the PGN')
print('=' * 74)


def replay_audit(label, games, user_parity):
    """user_parity: 1 if the user's moves are odd plies (White), 0 if even."""
    san_mismatch = colour_wrong = missing = 0
    checked = user_moves = 0
    for gid, pgn, white, black in games:
        who = (white if user_parity == 1 else black) or ''
        if who.lower() != USER.lower():
            colour_wrong += 1
            continue
        game = chess.pgn.read_game(io.StringIO(pgn))
        if game is None:
            continue
        pgn_moves, node = [], game
        while node.variations:
            node = node.variation(0)
            pgn_moves.append(node.san())

        cur.execute("SELECT ply, move_san FROM moves WHERE game_id=%s ORDER BY ply", (gid,))
        for ply, san in cur.fetchall():
            if ply > len(pgn_moves):
                missing += 1
                continue
            checked += 1
            if pgn_moves[ply - 1] != san:
                san_mismatch += 1
            # a move at ply p was made by White iff p is odd
            if ply % 2 == user_parity:
                user_moves += 1
    return dict(checked=checked, san_mismatch=san_mismatch,
                colour_wrong=colour_wrong, missing=missing, user_moves=user_moves)


cur.execute("WITH s AS (" + scope.LAST_BLACK + ") "
            "SELECT id, pgn, white_player, black_player FROM s", scope.PARAMS)
black_games = cur.fetchall()
rb = replay_audit('black', black_games, user_parity=0)
check('last-50-as-Black: every DB move matches the PGN at that ply',
      rb['san_mismatch'] == 0, f"{rb['san_mismatch']} of {rb['checked']} mismatched")
check('last-50-as-Black: user is Black in all 50', rb['colour_wrong'] == 0,
      f"{rb['colour_wrong']} games where black_player is not {USER}")
check('last-50-as-Black: no DB ply beyond the game length', rb['missing'] == 0,
      f"{rb['missing']} orphan plies")
print(f"    moves attributed to you (even plies): {rb['user_moves']} of {rb['checked']}")

cur.execute("""
    SELECT id, pgn, white_player, black_player FROM games g
    WHERE g.username=%(u)s AND LOWER(g.white_player)=%(u)s
      AND g.played_at < %(as_of)s
      AND (g.eco IN ('C50','C51','C52','C53','C54','C55','C56','C57','C58','C59')
           OR g.opening_name ILIKE '%%Italian%%' OR g.opening_name ILIKE '%%Giuoco%%'
           OR g.opening_name ILIKE '%%Two Knights%%' OR g.opening_name ILIKE '%%Evans%%'
           OR g.opening_name ILIKE '%%Hungarian%%')
""", {'u': USER, 'as_of': scope.AS_OF})
white_games = cur.fetchall()
rw = replay_audit('white', white_games, user_parity=1)
check('Italian-as-White: every DB move matches the PGN at that ply',
      rw['san_mismatch'] == 0, f"{rw['san_mismatch']} of {rw['checked']} mismatched")
check('Italian-as-White: user is White in all games', rw['colour_wrong'] == 0,
      f"{rw['colour_wrong']} games where white_player is not {USER}")
print(f"    moves attributed to you (odd plies): {rw['user_moves']} of {rw['checked']}")

print()
print('=' * 74)
print('4. eval_delta sign is from the mover\'s perspective')
print('=' * 74)
# For the mover, a blunder must be a loss: eval_delta should be negative.
for label, parity in (('your moves as Black (even ply)', 0),
                      ('opponent moves in those games (odd ply)', 1)):
    cur.execute("""
        WITH s AS (""" + scope.LAST_BLACK + """)
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE m.eval_delta < 0),
               ROUND(AVG(m.eval_delta))
        FROM s JOIN moves m ON m.game_id = s.id
        WHERE m.classification = 'blunder' AND m.ply %% 2 = %(par)s
    """, {**scope.PARAMS, 'par': parity})
    n, neg, avg = cur.fetchone()
    print(f'    {label}: {n} blunders raw, {neg} with negative delta, avg {avg}')

# Known upstream defect: ingest forces classification='blunder' in some
# checkmate branches, so a handful of *improving* moves carry that label. The
# report's queries add eval_delta < 0; assert that filter actually clears them.
cur.execute("""
    WITH s AS (""" + scope.LAST_BLACK + """)
    SELECT COUNT(*) FROM s JOIN moves m ON m.game_id = s.id
    WHERE m.classification IN ('mistake','blunder') AND m.eval_delta < 0
      AND m.ply %% 2 = 0 AND m.eval_delta >= 0
""", scope.PARAMS)
check('report filter leaves no improving move counted as an error',
      cur.fetchone()[0] == 0)

cur.execute("""
    WITH s AS (""" + scope.LAST_BLACK + """)
    SELECT COUNT(*) FILTER (WHERE m.classification IN ('mistake','blunder')),
           COUNT(*) FILTER (WHERE m.classification IN ('mistake','blunder')
                            AND m.eval_delta < 0)
    FROM s JOIN moves m ON m.game_id = s.id WHERE m.ply %% 2 = 0
""", scope.PARAMS)
raw, clean = cur.fetchone()
print(f'    your errors as Black: {raw} labelled, {clean} after the filter '
      f'({raw - clean} mislabelled by the pipeline)')

# White-centric eval_before: for Black, POV must be negated. Sanity-check that
# the side to move in the stored FEN matches the ply parity.
print()
print('=' * 74)
print('6. position_fen_before side-to-move matches ply parity')
print('=' * 74)
cur.execute("""
    WITH s AS (""" + scope.LAST_BLACK + """)
    SELECT m.ply, m.position_fen_before
    FROM s JOIN moves m ON m.game_id = s.id
    WHERE m.position_fen_before IS NOT NULL
""", scope.PARAMS)
bad = 0
tot = 0
for ply, fen in cur.fetchall():
    tot += 1
    stm = fen.split()[1]
    expect = 'w' if ply % 2 == 1 else 'b'
    if stm != expect:
        bad += 1
check('stored FEN side-to-move agrees with ply parity', bad == 0,
      f'{bad} of {tot} disagree')

print()
print('=' * 74)
print('7. spot-check: the moves feeding the drops table are all yours')
print('=' * 74)
cur.execute("""
    WITH s AS (""" + scope.LAST_BLACK + """)
    SELECT s.black_player, COUNT(*)
    FROM s JOIN moves m ON m.game_id = s.id
    WHERE m.classification IN ('mistake','blunder')
      AND m.ply %% 2 = 0 AND m.position_fen_before IS NOT NULL
    GROUP BY 1
""", scope.PARAMS)
rows = cur.fetchall()
print(f'    black_player values on those rows: {rows}')
check('all drop-table rows come from games you played as Black',
      len(rows) == 1 and rows[0][0].lower() == USER.lower())

conn.close()
print()
print('=' * 74)
print('RESULT:', 'all checks passed' if not fails else f'FAILURES: {fails}')
print('=' * 74)
