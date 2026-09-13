"""Recompute every figure the report quotes, excluding misclassified errors.

The ingest pipeline forces `classification='blunder'` in some mate-score
branches, which labels moves as blunders even when the evaluation improved —
12 of 13 such moves on Black's side are the engine's own top choice. A real
mistake must lose ground, so every error count here also requires
eval_delta < 0.
"""
import os
import psycopg2
from dotenv import load_dotenv
import scope

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
conn = psycopg2.connect(
    host=os.getenv('SUPABASE_HOST'), port=int(os.getenv('SUPABASE_PORT', 6543)),
    dbname=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'),
    password=os.getenv('SUPABASE_PASSWORD'), sslmode='require')
cur = conn.cursor()

ERR = "m.classification IN ('mistake','blunder') AND m.eval_delta < 0"
BLACK = "WITH s AS (" + scope.LAST_BLACK + ")"
WHITE_ITAL = """
WITH s AS (
    SELECT id, pgn, result, played_at, white_player, eco FROM games g
    WHERE g.username=%(u)s AND LOWER(g.white_player)=%(u)s
      AND g.played_at < %(as_of)s
      AND (g.eco IN ('C50','C51','C52','C53','C54','C55','C56','C57','C58','C59')
           OR g.opening_name ILIKE '%%Italian%%' OR g.opening_name ILIKE '%%Giuoco%%'
           OR g.opening_name ILIKE '%%Two Knights%%' OR g.opening_name ILIKE '%%Evans%%'
           OR g.opening_name ILIKE '%%Hungarian%%')
)"""
WP = {'u': scope.USER, 'as_of': scope.AS_OF}


def hdr(t):
    print('\n' + '=' * 74)
    print(t)
    print('=' * 74)


def run(sql, params):
    cur.execute(sql, params)
    return cur.fetchall()


for label, base, parity, params in (('BLACK — last 50', BLACK, 0, scope.PARAMS),
                                    ('WHITE — Italian', WHITE_ITAL, 1, WP)):
    hdr(label + ' :: classification mix on your moves')
    r = run(base + f"""
        SELECT COUNT(*),
               COUNT(*) FILTER (WHERE m.classification='good'),
               COUNT(*) FILTER (WHERE m.classification='inaccuracy'),
               COUNT(*) FILTER (WHERE m.classification='mistake' AND m.eval_delta<0),
               COUNT(*) FILTER (WHERE m.classification='blunder' AND m.eval_delta<0),
               COUNT(*) FILTER (WHERE {ERR}),
               AVG(LEAST(ABS(m.eval_delta),1000))::int,
               COUNT(DISTINCT s.id)
        FROM s JOIN moves m ON m.game_id=s.id
        WHERE m.ply %% 2 = {parity}
    """, params)[0]
    tot, good, inacc, mis, bl, err, acpl, games = r
    print(f'  moves {tot}  games {games}  ACPL(capped) {acpl}')
    print(f'  good {good} ({good/tot*100:.1f}%)  inacc {inacc} ({inacc/tot*100:.1f}%)  '
          f'mistake {mis} ({mis/tot*100:.1f}%)  blunder {bl} ({bl/tot*100:.1f}%)')
    print(f'  total errors {err}   per game: {mis/games:.2f} mistakes, {bl/games:.2f} blunders')

    print('\n  by phase:')
    for ph, mv, e, ac in run(base + f"""
        SELECT m.phase::text, COUNT(*),
               COUNT(*) FILTER (WHERE {ERR}),
               AVG(LEAST(ABS(m.eval_delta),1000))::int
        FROM s JOIN moves m ON m.game_id=s.id
        WHERE m.ply %% 2 = {parity} GROUP BY 1
    """, params):
        print(f'    {ph:11} moves={mv:5} errors={e:4} ({e/mv*100:4.1f}%) ACPL={ac}')

    print('\n  by move band:')
    bands = {1: 'moves 1-10', 2: 'moves 11-20', 3: 'moves 21-30',
             4: 'moves 31-40', 5: 'move 41+'}
    for b, mv, e, ac in run(base + f"""
        SELECT width_bucket((m.ply+1)/2, 1, 41, 4), COUNT(*),
               COUNT(*) FILTER (WHERE {ERR}),
               AVG(LEAST(ABS(m.eval_delta),1000))::int
        FROM s JOIN moves m ON m.game_id=s.id
        WHERE m.ply %% 2 = {parity} GROUP BY 1 ORDER BY 1
    """, params):
        print(f'    {bands.get(b,"?"):12} moves={mv:5} errors={e:4} ({e/mv*100:4.1f}%) ACPL={ac}')

    print('\n  by piece:')
    for p, mv, e in run(base + f"""
        SELECT m.piece_moved, COUNT(*), COUNT(*) FILTER (WHERE {ERR})
        FROM s JOIN moves m ON m.game_id=s.id
        WHERE m.ply %% 2 = {parity} GROUP BY 1 ORDER BY 3 DESC
    """, params):
        print(f'    {p:3} moves={mv:5} errors={e:4} ({e/mv*100:4.1f}%)')

# ---------------------------------------------------------------- Black extras
hdr('BLACK :: where the errors are played from')
for st, n, ac in run(BLACK + f"""
    SELECT CASE WHEN -m.eval_before > 100 THEN 'Black was better (+1 or more)'
                WHEN -m.eval_before >= -100 THEN 'roughly equal'
                ELSE 'Black already worse' END,
           COUNT(*), AVG(LEAST(ABS(m.eval_delta),1000))::int
    FROM s JOIN moves m ON m.game_id=s.id
    WHERE m.ply %% 2 = 0 AND {ERR} GROUP BY 1 ORDER BY 2 DESC
""", scope.PARAMS):
    print(f'  {st:32} x{n:<4} avg -{ac}cp')

hdr('BLACK :: endgame errors by the position they came from')
for st, n in run(BLACK + f"""
    SELECT CASE WHEN -m.eval_before >  300 THEN 'already winning (> +3)'
                WHEN -m.eval_before >  100 THEN 'better (+1 to +3)'
                WHEN -m.eval_before >= -100 THEN 'contested (-1 to +1)'
                WHEN -m.eval_before >= -300 THEN 'worse (-1 to -3)'
                ELSE 'already lost (< -3)' END, COUNT(*)
    FROM s JOIN moves m ON m.game_id=s.id
    WHERE m.phase='endgame' AND m.ply %% 2 = 0 AND {ERR}
    GROUP BY 1 ORDER BY 2 DESC
""", scope.PARAMS):
    print(f'  {st:26} x{n}')

print('\n  endgame errors by piece:')
for p, mv, e in run(BLACK + f"""
    SELECT m.piece_moved, COUNT(*), COUNT(*) FILTER (WHERE {ERR})
    FROM s JOIN moves m ON m.game_id=s.id
    WHERE m.phase='endgame' AND m.ply %% 2 = 0 GROUP BY 1 ORDER BY 3 DESC
""", scope.PARAMS):
    print(f'    {p:3} moves={mv:4} errors={e:3} ({e/mv*100:4.1f}%)')

hdr('BLACK :: blunder categories (clean)')
for c, n, ac in run(BLACK + f"""
    SELECT m.blunder_category::text, COUNT(*), AVG(LEAST(ABS(m.eval_delta),1000))::int
    FROM s JOIN moves m ON m.game_id=s.id
    WHERE m.ply %% 2 = 0 AND {ERR} AND m.blunder_category IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC
""", scope.PARAMS):
    print(f'  {c:22} x{n:<4} avg -{ac}cp')

# ---------------------------------------------------------------- White extras
hdr('WHITE :: error rate by move number 6-18')
for mvno, n, e in run(WHITE_ITAL + f"""
    SELECT (m.ply+1)/2, COUNT(*), COUNT(*) FILTER (WHERE {ERR})
    FROM s JOIN moves m ON m.game_id=s.id
    WHERE m.ply %% 2 = 1 AND (m.ply+1)/2 BETWEEN 6 AND 18
    GROUP BY 1 ORDER BY 1
""", WP):
    print(f'  move {mvno:2}  n={n:4}  errors {e:4} ({e/n*100:4.1f}%)')

hdr('WHITE :: recurring error moves (clean, >=5x)')
for san, n, bl, ac, lo, hi in run(WHITE_ITAL + f"""
    SELECT m.move_san, COUNT(*),
           COUNT(*) FILTER (WHERE m.classification='blunder'),
           AVG(ABS(m.eval_delta))::int, MIN((m.ply+1)/2), MAX((m.ply+1)/2)
    FROM s JOIN moves m ON m.game_id=s.id
    WHERE m.ply %% 2 = 1 AND {ERR}
    GROUP BY 1 HAVING COUNT(*) >= 5 ORDER BY 2 DESC LIMIT 12
""", WP):
    print(f'  {san:9} x{n:<3} blunders={bl:<3} avg -{ac:<5}cp (moves {lo}-{hi})')

hdr('WHITE :: Bxf7 sacrifices (clean)')
for cls, n, ac in run(WHITE_ITAL + """
    SELECT m.classification::text, COUNT(*), AVG(ABS(m.eval_delta))::int
    FROM s JOIN moves m ON m.game_id=s.id
    WHERE m.ply %% 2 = 1 AND m.move_san LIKE 'Bxf7%%'
    GROUP BY 1 ORDER BY 2 DESC
""", WP):
    print(f'  {cls:12} x{n:<3} avg -{ac}cp')
r = run(WHITE_ITAL + f"""
    SELECT COUNT(*), AVG(ABS(m.eval_delta))::int, COUNT(DISTINCT s.id),
           COUNT(*) FILTER (WHERE s.result='0-1')
    FROM s JOIN moves m ON m.game_id=s.id
    WHERE m.ply %% 2 = 1 AND m.move_san LIKE 'Bxf7%%' AND {ERR}
""", WP)[0]
print(f'  unsound: {r[0]} moves, avg -{r[1]}cp, {r[2]} distinct games, {r[3]} lost')

conn.close()
