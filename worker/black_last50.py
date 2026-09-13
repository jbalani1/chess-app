"""Core-mistake analysis of the user's last 50 games as Black.

Evals are White-centric in the DB; eval_delta is already from the mover's
perspective (negative = the mover lost ground). For Black-POV position eval we
negate eval_after.
"""
import os
import re
import io
import psycopg2
import chess.pgn
from collections import Counter, defaultdict
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
USER = 'negrilmannings'
N = 50

conn = psycopg2.connect(
    host=os.getenv('SUPABASE_HOST'),
    port=int(os.getenv('SUPABASE_PORT', 6543)),
    dbname=os.getenv('SUPABASE_DB'),
    user=os.getenv('SUPABASE_USER'),
    password=os.getenv('SUPABASE_PASSWORD'),
    sslmode='require',
)
cur = conn.cursor()

# Scope CTE reused everywhere: last N games where the user had Black.
SCOPE = """
WITH last50 AS (
    SELECT id, eco, opening_name, result, time_control, played_at, pgn,
           white_player
    FROM games
    WHERE username = %(u)s AND LOWER(black_player) = %(u)s
    ORDER BY played_at DESC
    LIMIT %(n)s
)
"""
P = {'u': USER, 'n': N}
# Black's own moves are even plies.
BLACK_MOVE = "AND m.ply %% 2 = 0"


def hdr(t):
    print("\n" + "=" * 78)
    print(t)
    print("=" * 78)


# ---------------------------------------------------------------- scope
hdr("SCOPE — last 50 games as Black")
cur.execute(SCOPE + """
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE result='0-1') wins,
           COUNT(*) FILTER (WHERE result='1-0') losses,
           COUNT(*) FILTER (WHERE result='1/2-1/2') draws,
           MIN(played_at)::date, MAX(played_at)::date
    FROM last50
""", P)
g, w, l, d, d0, d1 = cur.fetchone()
print(f"  {g} games  {d0} .. {d1}")
print(f"  W/L/D as Black: {w}/{l}/{d}   score {(w + 0.5*d)/g*100:.1f}%")

cur.execute(SCOPE + """
    SELECT time_control, COUNT(*),
           COUNT(*) FILTER (WHERE result='0-1'),
           COUNT(*) FILTER (WHERE result='1/2-1/2')
    FROM last50 GROUP BY time_control ORDER BY 2 DESC
""", P)
print("\n  by time control (tc / games / wins / draws / score%):")
for tc, n, ww, dd in cur.fetchall():
    print(f"    {tc or '?':10} {n:3}  {ww:3} {dd:3}   {(ww + 0.5*dd)/n*100:5.1f}%")

# ---------------------------------------------------------------- repertoire
hdr("REPERTOIRE — what Black actually plays (parsed from PGN)")
cur.execute(SCOPE + " SELECT id, pgn, result, eco, opening_name FROM last50", P)
games = cur.fetchall()

first_white = Counter()
reply = Counter()          # (white 1st move, black 1st move)
line6 = Counter()          # first 6 plies
score_by_reply = defaultdict(lambda: [0, 0.0])   # key -> [games, points]
game_lines = {}

for gid, pgn, result, eco, name in games:
    game = chess.pgn.read_game(io.StringIO(pgn))
    if game is None:
        continue
    moves = []
    node = game
    while node.variations and len(moves) < 12:
        node = node.variation(0)
        moves.append(node.san())
    game_lines[gid] = moves
    if not moves:
        continue
    w1 = moves[0]
    b1 = moves[1] if len(moves) > 1 else '-'
    first_white[w1] += 1
    key = f"{w1} {b1}"
    reply[key] += 1
    pts = 1.0 if result == '0-1' else (0.5 if result == '1/2-1/2' else 0.0)
    score_by_reply[key][0] += 1
    score_by_reply[key][1] += pts
    line6[' '.join(moves[:6])] += 1

print("  White's first move faced:")
for m, n in first_white.most_common():
    print(f"    {m:6} {n:3}")

print("\n  Black's reply (games / score%):")
for k, n in reply.most_common():
    gg, pp = score_by_reply[k]
    print(f"    {k:14} {n:3}   {pp/gg*100:5.1f}%")

print("\n  most common 3-move lines (>=2 games):")
for k, n in line6.most_common(14):
    if n >= 2:
        print(f"    x{n}  {k}")

# ---------------------------------------------------------------- opening perf
# games.opening_name is 'Unknown' in the live DB, so derive real names from the
# chess.com ECOUrl header in the PGN.
def eco_url_name(pgn):
    m = re.search(r'\[ECOUrl "https?://[^"]*/openings/([^"]+)"\]', pgn)
    if not m:
        return None
    return m.group(1).replace('-', ' ')


opening_of = {}
for gid, pgn, result, eco, name in games:
    opening_of[gid] = eco_url_name(pgn) or (name or '?')

# per-game aggregates on Black's own moves (ACPL capped at 1000 so forced-mate
# scores of ±10000 don't swamp the average)
cur.execute(SCOPE + """
    SELECT l.id, l.result, l.eco,
           AVG(LEAST(ABS(m.eval_delta), 1000))::int acpl,
           COUNT(*) FILTER (WHERE m.classification='mistake') mis,
           COUNT(*) FILTER (WHERE m.classification='blunder') bl,
           COUNT(*) n
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE TRUE """ + BLACK_MOVE + """
    GROUP BY l.id, l.result, l.eco
""", P)
per_game = cur.fetchall()

hdr("PERFORMANCE BY OPENING (as Black, name from PGN ECOUrl)")


def report(keyfn, title, min_n=1):
    agg = defaultdict(lambda: {'n': 0, 'pts': 0.0, 'acpl': 0, 'mis': 0, 'bl': 0, 'mv': 0})
    for gid, result, eco, acpl, mis, bl, n in per_game:
        k = keyfn(gid, eco)
        a = agg[k]
        a['n'] += 1
        a['pts'] += 1.0 if result == '0-1' else (0.5 if result == '1/2-1/2' else 0.0)
        a['acpl'] += acpl * n
        a['mv'] += n
        a['mis'] += mis
        a['bl'] += bl
    print(f"\n  {title}")
    print(f"  {'line':46} {'n':>3} {'score%':>7} {'ACPL':>5} {'mis/g':>6} {'bl/g':>5}")
    for k, a in sorted(agg.items(), key=lambda kv: (-kv[1]['n'], kv[0])):
        if a['n'] < min_n:
            continue
        print(f"  {str(k)[:46]:46} {a['n']:3} {a['pts']/a['n']*100:6.1f}% "
              f"{a['acpl']/a['mv']:5.0f} {a['mis']/a['n']:6.2f} {a['bl']/a['n']:5.2f}")


report(lambda gid, eco: opening_of.get(gid, '?'), "by full opening name")
report(lambda gid, eco: ' '.join(str(opening_of.get(gid, '?')).split()[:3]),
       "by opening family (first 3 words)", min_n=2)

# grouped by ECO letter-family
hdr("PERFORMANCE BY ECO FAMILY (as Black)")
cur.execute(SCOPE + """
    SELECT LEFT(l.eco,2) fam, COUNT(DISTINCT l.id) n,
           COUNT(DISTINCT l.id) FILTER (WHERE l.result='0-1') w,
           COUNT(DISTINCT l.id) FILTER (WHERE l.result='1/2-1/2') d,
           AVG(ABS(m.eval_delta))::int acpl,
           COUNT(*) FILTER (WHERE m.classification='blunder') bl,
           COUNT(*) FILTER (WHERE m.classification='mistake') mi
    FROM last50 l JOIN moves m ON m.game_id = l.id
    WHERE TRUE """ + BLACK_MOVE + """
    GROUP BY fam HAVING COUNT(DISTINCT l.id) >= 2
    ORDER BY n DESC
""", P)
print("  fam   n  score%  ACPL  blunders mistakes")
for fam, n, w, d, acpl, bl, mi in cur.fetchall():
    print(f"  {fam or '?':4} {n:3}  {(w+0.5*d)/n*100:5.1f}  {acpl:5}  {bl:6}  {mi:6}")

# ---------------------------------------------------------------- error profile
hdr("ERROR PROFILE — Black's own moves")
cur.execute(SCOPE + """
    SELECT COUNT(*) moves,
           COUNT(*) FILTER (WHERE m.classification='good') good,
           COUNT(*) FILTER (WHERE m.classification='inaccuracy') inacc,
           COUNT(*) FILTER (WHERE m.classification='mistake') mis,
           COUNT(*) FILTER (WHERE m.classification='blunder') bl,
           AVG(LEAST(ABS(m.eval_delta),1000))::int acpl
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE TRUE """ + BLACK_MOVE, P)
tot, good, inacc, mis, bl, acpl = cur.fetchone()
print(f"  Black moves analyzed: {tot}   ACPL (capped 1000) {acpl}")
print(f"  good {good} ({good/tot*100:.1f}%)  inacc {inacc} ({inacc/tot*100:.1f}%)"
      f"  mistake {mis} ({mis/tot*100:.1f}%)  blunder {bl} ({bl/tot*100:.1f}%)")
print(f"  per game: {mis/N:.2f} mistakes, {bl/N:.2f} blunders")

print("\n  --- by phase ---")
cur.execute(SCOPE + """
    SELECT m.phase, COUNT(*) n,
           COUNT(*) FILTER (WHERE m.classification='mistake') mis,
           COUNT(*) FILTER (WHERE m.classification='blunder') bl,
           AVG(ABS(m.eval_delta))::int acpl
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE TRUE """ + BLACK_MOVE + """
    GROUP BY m.phase ORDER BY 2 DESC
""", P)
for ph, n, mm, bb, ac in cur.fetchall():
    print(f"  {ph:11} moves={n:5} mistakes={mm:3} blunders={bb:3} err={(mm+bb)/n*100:4.1f}% ACPL={ac}")

print("\n  --- by move-number band ---")
cur.execute(SCOPE + """
    SELECT width_bucket((m.ply+1)/2, 1, 41, 4) band, COUNT(*) n,
           COUNT(*) FILTER (WHERE m.classification IN ('mistake','blunder')) err,
           AVG(ABS(m.eval_delta))::int acpl
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE TRUE """ + BLACK_MOVE + """
    GROUP BY band ORDER BY band
""", P)
bands = {1: 'moves 1-10', 2: 'moves 11-20', 3: 'moves 21-30', 4: 'moves 31-40', 5: 'move 41+'}
for b, n, err, ac in cur.fetchall():
    print(f"  {bands.get(b,'?'):12} moves={n:5} errors={err:3} ({err/n*100:4.1f}%) ACPL={ac}")

print("\n  --- by piece moved (mistakes+blunders) ---")
cur.execute(SCOPE + """
    SELECT m.piece_moved, COUNT(*) tot,
           COUNT(*) FILTER (WHERE m.classification IN ('mistake','blunder')) err,
           AVG(ABS(m.eval_delta))::int acpl
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE TRUE """ + BLACK_MOVE + """
    GROUP BY m.piece_moved ORDER BY err DESC
""", P)
for p, t, e, ac in cur.fetchall():
    print(f"  {p:3} moves={t:5} errors={e:3} ({e/t*100:4.1f}%) ACPL={ac}")

print("\n  --- blunder categories ---")
cur.execute(SCOPE + """
    SELECT m.blunder_category, COUNT(*) n, AVG(ABS(m.eval_delta))::int avg_loss,
           COUNT(*) FILTER (WHERE m.phase='opening') op,
           COUNT(*) FILTER (WHERE m.phase='middlegame') mg,
           COUNT(*) FILTER (WHERE m.phase='endgame') eg
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE m.classification IN ('mistake','blunder')
      AND m.blunder_category IS NOT NULL """ + BLACK_MOVE + """
    GROUP BY 1 ORDER BY n DESC
""", P)
rows = cur.fetchall()
if not rows:
    print("    (no blunder_category data)")
for c, n, ac, op, mg, eg in rows:
    print(f"  {c:22} x{n:<3} avg -{ac}cp   (op {op} / mg {mg} / eg {eg})")

print("\n  --- tactical motifs on error moves ---")
cur.execute(SCOPE + """
    SELECT elem->>'motif_type' motif, COUNT(*) n, AVG(ABS(m.eval_delta))::int ac
    FROM last50 l JOIN moves m ON m.game_id=l.id,
         jsonb_array_elements(m.tactical_motifs) elem
    WHERE m.classification IN ('mistake','blunder') """ + BLACK_MOVE + """
    GROUP BY 1 ORDER BY n DESC LIMIT 14
""", P)
for r in cur.fetchall():
    print(f"    {r[0]:24} x{r[1]:<3} avg -{r[2]}cp")

print("\n  --- positional patterns on error moves ---")
cur.execute(SCOPE + """
    SELECT elem->>'pattern_type' pat, COUNT(*) n, AVG(ABS(m.eval_delta))::int ac
    FROM last50 l JOIN moves m ON m.game_id=l.id,
         jsonb_array_elements(m.positional_patterns) elem
    WHERE m.classification IN ('mistake','blunder') """ + BLACK_MOVE + """
    GROUP BY 1 ORDER BY n DESC LIMIT 14
""", P)
for r in cur.fetchall():
    print(f"    {r[0]:28} x{r[1]:<3} avg -{r[2]}cp")

# ---------------------------------------------------------------- repeats
hdr("RECURRING EXACT MISTAKES (same move number + same SAN, >=2x)")
cur.execute(SCOPE + """
    SELECT (m.ply+1)/2 moveno, m.move_san, m.piece_moved, COUNT(*) n,
           AVG(ABS(m.eval_delta))::int ac,
           COUNT(*) FILTER (WHERE m.classification='blunder') bl,
           array_agg(DISTINCT m.best_move_san) FILTER (WHERE m.best_move_san IS NOT NULL) better
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE m.classification IN ('mistake','blunder') """ + BLACK_MOVE + """
    GROUP BY 1,2,3 HAVING COUNT(*) >= 2
    ORDER BY n DESC, ac DESC LIMIT 25
""", P)
rows = cur.fetchall()
if not rows:
    print("  (none repeated)")
for r in rows:
    better = ', '.join((r[6] or [])[:3]) or '?'
    print(f"  move {r[0]:>2}. {r[1]:8} [{r[2]}] x{r[3]}  avg -{r[4]}cp  blunders={r[5]}  better: {better}")

hdr("RECURRING MISTAKE SQUARES / MOVE TYPES (SAN ignoring move number, >=3x)")
cur.execute(SCOPE + """
    SELECT m.move_san, COUNT(*) n, AVG(ABS(m.eval_delta))::int ac,
           MIN((m.ply+1)/2) first_mv, MAX((m.ply+1)/2) last_mv
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE m.classification IN ('mistake','blunder') """ + BLACK_MOVE + """
    GROUP BY 1 HAVING COUNT(*) >= 3 ORDER BY n DESC LIMIT 25
""", P)
for r in cur.fetchall():
    print(f"  {r[0]:9} x{r[1]:<3} avg -{r[2]}cp  (moves {r[3]}-{r[4]})")

# ---------------------------------------------------------------- opening health
hdr("OPENING HEALTH — Black's eval after move 10 / 15 / 20 (Black POV, cp)")
cur.execute(SCOPE + """
    SELECT p.mv,
           COUNT(*) n,
           AVG(-m.eval_after)::int avg_cp,
           COUNT(*) FILTER (WHERE -m.eval_after < -100) worse_100,
           COUNT(*) FILTER (WHERE -m.eval_after < -300) losing
    FROM last50 l
    JOIN LATERAL (VALUES (10),(15),(20)) p(mv) ON TRUE
    JOIN moves m ON m.game_id=l.id AND m.ply = p.mv*2
    GROUP BY p.mv ORDER BY p.mv
""", P)
for mv, n, avg, bad, lost in cur.fetchall():
    print(f"  after Black's move {mv:2}: n={n:3}  avg {avg:+5}cp   worse than -1.00 in {bad} games   below -3.00 in {lost}")

print("\n  --- openings where Black is already worse by move 12 (avg Black-POV cp) ---")
cur.execute(SCOPE + """
    SELECT l.eco, l.opening_name, COUNT(*) n, AVG(-m.eval_after)::int cp
    FROM last50 l JOIN moves m ON m.game_id=l.id AND m.ply = 24
    GROUP BY 1,2 HAVING COUNT(*) >= 2 ORDER BY cp ASC LIMIT 15
""", P)
for eco, name, n, cp in cur.fetchall():
    print(f"    {eco or '?':4} {(name or '?')[:44]:44} n={n:2}  {cp:+5}cp")

# ---------------------------------------------------------------- decisive drops
hdr("DECISIVE ERRORS — the move that lost each lost game")
cur.execute(SCOPE + """
    SELECT l.id, l.opening_name, (m.ply+1)/2 moveno, m.move_san,
           ABS(m.eval_delta) loss, m.best_move_san, m.blunder_category, m.phase,
           -m.eval_before before_cp, -m.eval_after after_cp
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE l.result='1-0' """ + BLACK_MOVE + """
      AND m.classification='blunder'
    ORDER BY l.played_at DESC, loss DESC
""", P)
rows = cur.fetchall()
seen = set()
print("  (largest blunder per lost game)")
for r in rows:
    if r[0] in seen:
        continue
    seen.add(r[0])
    print(f"  mv {r[2]:>2}. {r[3]:8} -{r[4]:<5}cp  {r[8]:+5} -> {r[9]:+5}  "
          f"{(r[6] or '?'):20} {r[7]:11} better:{r[5] or '?':7} [{(r[1] or '')[:26]}]")
print(f"  lost games with an identified blunder: {len(seen)}")

hdr("SWING SIZE — where the games actually turn")
cur.execute(SCOPE + """
    SELECT CASE
             WHEN -m.eval_before > 100 THEN 'Black was better (+1 or more)'
             WHEN -m.eval_before >= -100 THEN 'roughly equal'
             ELSE 'Black already worse'
           END state,
           COUNT(*) n, AVG(ABS(m.eval_delta))::int ac
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE m.classification IN ('mistake','blunder') """ + BLACK_MOVE + """
    GROUP BY 1 ORDER BY n DESC
""", P)
for r in cur.fetchall():
    print(f"  {r[0]:32} x{r[1]:<4} avg -{r[2]}cp")

conn.close()
print("\ndone.")
