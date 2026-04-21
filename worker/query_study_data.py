"""Query Supabase for middlegame mistakes/blunders in last 60 days."""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

conn = psycopg2.connect(
    host=os.getenv('SUPABASE_HOST'),
    port=int(os.getenv('SUPABASE_PORT', 6543)),
    dbname=os.getenv('SUPABASE_DB'),
    user=os.getenv('SUPABASE_USER'),
    password=os.getenv('SUPABASE_PASSWORD'),
    sslmode='require',
)

cur = conn.cursor()

# user_color filter: if white_player=username then user plays odd ply, else even
USER_MOVE_FILTER = """
    AND (
        (LOWER(g.white_player) = 'negrilmannings' AND m.ply % 2 = 1)
        OR (LOWER(g.black_player) = 'negrilmannings' AND m.ply % 2 = 0)
    )
"""

BASE_WHERE = f"""
    WHERE g.username = 'negrilmannings'
      AND g.played_at >= NOW() - INTERVAL '60 days'
      AND m.phase = 'middlegame'
      AND m.classification IN ('mistake', 'blunder')
      {USER_MOVE_FILTER}
"""

# 1. Summary
cur.execute(f"SELECT m.classification, COUNT(*), AVG(ABS(m.eval_delta))::int FROM moves m JOIN games g ON m.game_id=g.id {BASE_WHERE} GROUP BY m.classification")
print("=== SUMMARY ===")
for row in cur.fetchall():
    print(f"  {row[0]}: count={row[1]}, avg_loss={row[2]}cp")

# 2. By opening
cur.execute(f"SELECT g.opening_name, g.eco, COUNT(*) as cnt, AVG(ABS(m.eval_delta))::int FROM moves m JOIN games g ON m.game_id=g.id {BASE_WHERE} GROUP BY g.opening_name, g.eco ORDER BY cnt DESC LIMIT 15")
print("\n=== BY OPENING ===")
for row in cur.fetchall():
    print(f"  {row[0]} ({row[1]}): count={row[2]}, avg_loss={row[3]}cp")

# 3. By blunder category
cur.execute(f"SELECT m.blunder_category, COUNT(*) as cnt, AVG(ABS(m.eval_delta))::int FROM moves m JOIN games g ON m.game_id=g.id {BASE_WHERE} AND m.blunder_category IS NOT NULL GROUP BY m.blunder_category ORDER BY cnt DESC")
print("\n=== BY CATEGORY ===")
for row in cur.fetchall():
    print(f"  {row[0]}: count={row[1]}, avg_loss={row[2]}cp")

# 4. By tactical motif
cur.execute(f"""
    SELECT elem->>'motif_type' as motif, COUNT(*) as cnt, AVG(ABS(m.eval_delta))::int
    FROM moves m JOIN games g ON m.game_id=g.id,
         jsonb_array_elements(m.tactical_motifs) elem
    {BASE_WHERE}
    GROUP BY motif ORDER BY cnt DESC LIMIT 10
""")
print("\n=== BY TACTICAL MOTIF ===")
for row in cur.fetchall():
    print(f"  {row[0]}: count={row[1]}, avg_loss={row[2]}cp")

# 5. Opening x Category
cur.execute(f"""
    SELECT g.opening_name, m.blunder_category, COUNT(*) as cnt
    FROM moves m JOIN games g ON m.game_id=g.id
    {BASE_WHERE} AND m.blunder_category IS NOT NULL
    GROUP BY g.opening_name, m.blunder_category HAVING COUNT(*) >= 2
    ORDER BY cnt DESC LIMIT 20
""")
print("\n=== OPENING x CATEGORY (>=2) ===")
for row in cur.fetchall():
    print(f"  {row[0]} / {row[1]}: {row[2]}")

# 6. Total games
cur.execute("SELECT COUNT(DISTINCT g.id), MIN(g.played_at)::date, MAX(g.played_at)::date FROM games g WHERE g.username='negrilmannings' AND g.played_at >= NOW() - INTERVAL '60 days'")
row = cur.fetchone()
print(f"\n=== GAMES: {row[0]} games from {row[1]} to {row[2]} ===")

conn.close()
