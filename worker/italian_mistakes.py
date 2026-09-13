"""Analyze the user's recurring mistakes in the Italian Opening.

Layer 1: exact repeated move mistakes (same move / same position played as a mistake).
Layer 2: broader thematic & motif mistakes.
"""
import os
import psycopg2
from collections import defaultdict
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

USER = 'negrilmannings'

conn = psycopg2.connect(
    host=os.getenv('SUPABASE_HOST'),
    port=int(os.getenv('SUPABASE_PORT', 6543)),
    dbname=os.getenv('SUPABASE_DB'),
    user=os.getenv('SUPABASE_USER'),
    password=os.getenv('SUPABASE_PASSWORD'),
    sslmode='require',
)
cur = conn.cursor()

# Italian Opening: ECO C50-C55 (Giuoco Piano, Two Knights, Evans, Hungarian, etc.)
# plus name-based catch for mislabeled ECOs.
ITALIAN = """
    g.username = %(user)s
    AND (
        g.eco IN ('C50','C51','C52','C53','C54','C55')
        OR g.opening_name ILIKE '%%Italian%%'
        OR g.opening_name ILIKE '%%Giuoco%%'
        OR g.opening_name ILIKE '%%Two Knights%%'
        OR g.opening_name ILIKE '%%Evans%%'
        OR g.opening_name ILIKE '%%Hungarian%%'
    )
"""

# user move filter (depends on color)
USER_MOVE = """
    AND (
        (LOWER(g.white_player) = %(user)s AND m.ply %% 2 = 1)
        OR (LOWER(g.black_player) = %(user)s AND m.ply %% 2 = 0)
    )
"""

# computed color (no user_color column in live DB)
COLOR = "CASE WHEN LOWER(g.white_player)=%(user)s THEN 'white' ELSE 'black' END"

P = {'user': USER}

print("=" * 70)
print("ITALIAN OPENING — game scope")
print("=" * 70)
cur.execute(f"""
    SELECT {COLOR} color, COUNT(*) games,
           COUNT(*) FILTER (WHERE g.result='1-0') w_white,
           COUNT(*) FILTER (WHERE g.result='0-1') w_black,
           COUNT(*) FILTER (WHERE g.result='1/2-1/2') draws,
           MIN(g.played_at)::date, MAX(g.played_at)::date
    FROM games g WHERE {ITALIAN} GROUP BY color
""", P)
for r in cur.fetchall():
    print(f"  color={r[0]:6} games={r[1]:3}  W/B/D wins(1-0)={r[2]}/(0-1)={r[3]}/draw={r[4]}  {r[5]}..{r[6]}")

cur.execute(f"""
    SELECT g.eco, g.opening_name, {COLOR} color, COUNT(*) n
    FROM games g WHERE {ITALIAN}
    GROUP BY g.eco, g.opening_name, color ORDER BY n DESC LIMIT 25
""", P)
print("\n  ECO / opening_name / color / #games:")
for r in cur.fetchall():
    print(f"    {r[0] or '?':4} {(r[1] or '?')[:42]:42} {r[2]:6} {r[3]}")

# ---------------------------------------------------------------------------
# LAYER 1A: exact repeated move mistakes by (ply, move_san)
# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("LAYER 1A — EXACT moves you repeatedly play that are mistakes")
print("  (same SAN at same move number, classified mistake/blunder)")
print("=" * 70)
cur.execute(f"""
    SELECT (m.ply+1)/2 AS moveno, m.move_san, m.piece_moved,
           COUNT(*) n,
           AVG(ABS(m.eval_delta))::int avg_loss,
           COUNT(*) FILTER (WHERE m.classification='blunder') blunders,
           array_agg(DISTINCT m.best_move_san) FILTER (WHERE m.best_move_san IS NOT NULL) better
    FROM moves m JOIN games g ON m.game_id=g.id
    WHERE {ITALIAN} {USER_MOVE}
      AND m.classification IN ('mistake','blunder')
    GROUP BY moveno, m.move_san, m.piece_moved
    HAVING COUNT(*) >= 2
    ORDER BY n DESC, avg_loss DESC
    LIMIT 30
""", P)
rows = cur.fetchall()
if not rows:
    print("  (no move repeated >=2 times — will widen below)")
for r in rows:
    better = ', '.join((r[6] or [])[:3]) or '?'
    print(f"  move {r[0]:>2}. {r[1]:7} [{r[2]}]  x{r[3]}  avg -{r[4]}cp  blunders={r[5]}  better: {better}")

# ---------------------------------------------------------------------------
# LAYER 1B: exact repeated mistakes by identical position (fen_before + move)
# strongest signal for "I keep making the same exchange in the same position"
# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("LAYER 1B — SAME POSITION, same move, repeated mistake")
print("  (identical position_fen_before -> same wrong move)")
print("=" * 70)
cur.execute(f"""
    SELECT split_part(m.position_fen_before,' ',1) board, m.move_san,
           (m.ply+1)/2 moveno,
           COUNT(*) n, AVG(ABS(m.eval_delta))::int avg_loss,
           array_agg(DISTINCT m.best_move_san) FILTER (WHERE m.best_move_san IS NOT NULL) better
    FROM moves m JOIN games g ON m.game_id=g.id
    WHERE {ITALIAN} {USER_MOVE}
      AND m.classification IN ('mistake','blunder')
      AND m.position_fen_before IS NOT NULL
    GROUP BY board, m.move_san, moveno
    HAVING COUNT(*) >= 2
    ORDER BY n DESC, avg_loss DESC LIMIT 20
""", P)
rows = cur.fetchall()
if not rows:
    print("  (no identical-position repeat — exact FEN repeats are rare; see 1A & 1C)")
for r in rows:
    better = ', '.join((r[5] or [])[:3]) or '?'
    print(f"  move {r[2]}. {r[1]:7}  x{r[3]}  avg -{r[4]}cp  better: {better}")

# ---------------------------------------------------------------------------
# LAYER 1C: central pawn exchanges specifically (the user's stated suspicion)
# captures by a pawn, or any capture onto central squares d4/d5/e4/e5/c/f files
# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("LAYER 1C — central pawn exchanges / captures that are mistakes")
print("=" * 70)
cur.execute(f"""
    SELECT (m.ply+1)/2 moveno, m.move_san, m.piece_moved,
           m.classification, ABS(m.eval_delta) loss, m.best_move_san,
           g.opening_name, g.played_at::date, {COLOR}
    FROM moves m JOIN games g ON m.game_id=g.id
    WHERE {ITALIAN} {USER_MOVE}
      AND m.classification IN ('mistake','blunder')
      AND m.move_san LIKE '%%x%%'
      AND (m.piece_moved='P' OR m.move_san ~ '^[a-h]x')
    ORDER BY loss DESC LIMIT 25
""", P)
rows = cur.fetchall()
if not rows:
    print("  (no pawn-capture mistakes found)")
for r in rows:
    print(f"  {r[7]} {r[8]:6} move {r[0]:>2}. {r[1]:7} {r[3]:8} -{r[4]}cp  better:{r[5] or '?'}  [{r[6][:28] if r[6] else ''}]")

# also aggregate: which capturing pawn moves recur
cur.execute(f"""
    SELECT m.move_san, COUNT(*) n, AVG(ABS(m.eval_delta))::int avg_loss,
           array_agg(DISTINCT m.best_move_san) FILTER (WHERE m.best_move_san IS NOT NULL) better
    FROM moves m JOIN games g ON m.game_id=g.id
    WHERE {ITALIAN} {USER_MOVE}
      AND m.classification IN ('mistake','blunder')
      AND m.move_san LIKE '%%x%%'
      AND (m.piece_moved='P' OR m.move_san ~ '^[a-h]x')
    GROUP BY m.move_san HAVING COUNT(*) >= 2
    ORDER BY n DESC LIMIT 15
""", P)
rows = cur.fetchall()
print("\n  recurring pawn-capture mistakes (same SAN, >=2x):")
if not rows:
    print("    (none repeated)")
for r in rows:
    better = ', '.join((r[3] or [])[:3]) or '?'
    print(f"    {r[0]:8} x{r[1]}  avg -{r[2]}cp  better: {better}")

# ---------------------------------------------------------------------------
# LAYER 2: thematic / motif mistakes
# ---------------------------------------------------------------------------
print("\n" + "=" * 70)
print("LAYER 2 — THEMATIC: blunder categories in the Italian")
print("=" * 70)
cur.execute(f"""
    SELECT m.blunder_category, COUNT(*) n, AVG(ABS(m.eval_delta))::int avg_loss,
           COUNT(*) FILTER (WHERE m.phase='opening') in_opening
    FROM moves m JOIN games g ON m.game_id=g.id
    WHERE {ITALIAN} {USER_MOVE}
      AND m.classification IN ('mistake','blunder')
      AND m.blunder_category IS NOT NULL
    GROUP BY m.blunder_category ORDER BY n DESC
""", P)
for r in cur.fetchall():
    print(f"  {r[0]:22} x{r[1]:<3} avg -{r[2]}cp   ({r[3]} in opening phase)")

print("\n  --- by piece moved ---")
cur.execute(f"""
    SELECT m.piece_moved, COUNT(*) n, AVG(ABS(m.eval_delta))::int avg_loss
    FROM moves m JOIN games g ON m.game_id=g.id
    WHERE {ITALIAN} {USER_MOVE} AND m.classification IN ('mistake','blunder')
    GROUP BY m.piece_moved ORDER BY n DESC
""", P)
for r in cur.fetchall():
    print(f"  piece {r[0]:3} x{r[1]:<3} avg -{r[2]}cp")

print("\n  --- by phase & when in the game (move number bands) ---")
cur.execute(f"""
    SELECT m.phase,
           width_bucket((m.ply+1)/2, 1, 41, 4) band,
           COUNT(*) n, AVG(ABS(m.eval_delta))::int avg_loss
    FROM moves m JOIN games g ON m.game_id=g.id
    WHERE {ITALIAN} {USER_MOVE} AND m.classification IN ('mistake','blunder')
    GROUP BY m.phase, band ORDER BY n DESC LIMIT 12
""", P)
bands = {1:'moves 1-10', 2:'moves 11-20', 3:'moves 21-30', 4:'moves 31-40', 5:'move 41+'}
for r in cur.fetchall():
    print(f"  {r[0]:11} {bands.get(r[1],'?'):12} x{r[2]:<3} avg -{r[3]}cp")

print("\n  --- tactical motifs you walk into / miss ---")
cur.execute(f"""
    SELECT elem->>'motif_type' motif, COUNT(*) n, AVG(ABS(m.eval_delta))::int avg_loss
    FROM moves m JOIN games g ON m.game_id=g.id,
         jsonb_array_elements(m.tactical_motifs) elem
    WHERE {ITALIAN} {USER_MOVE} AND m.classification IN ('mistake','blunder')
    GROUP BY motif ORDER BY n DESC LIMIT 12
""", P)
rows = cur.fetchall()
if not rows:
    print("    (no tactical motif data on these moves)")
for r in rows:
    print(f"    {r[0]:22} x{r[1]:<3} avg -{r[2]}cp")

print("\n  --- positional patterns ---")
cur.execute(f"""
    SELECT elem->>'pattern_type' pat, COUNT(*) n, AVG(ABS(m.eval_delta))::int avg_loss
    FROM moves m JOIN games g ON m.game_id=g.id,
         jsonb_array_elements(m.positional_patterns) elem
    WHERE {ITALIAN} {USER_MOVE} AND m.classification IN ('mistake','blunder')
    GROUP BY pat ORDER BY n DESC LIMIT 12
""", P)
rows = cur.fetchall()
if not rows:
    print("    (no positional pattern data on these moves)")
for r in rows:
    print(f"    {r[0]:26} x{r[1]:<3} avg -{r[2]}cp")

conn.close()
print("\ndone.")
