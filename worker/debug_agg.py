import os, psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv
load_dotenv()

conn = psycopg2.connect(host=os.getenv('SUPABASE_HOST'), port=os.getenv('SUPABASE_PORT'), database=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'), password=os.getenv('SUPABASE_PASSWORD'), sslmode=os.getenv('PGSSLMODE','require'))
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute("""
    SELECT
        array_agg(m.game_id ORDER BY ABS(m.eval_delta) DESC) as all_game_ids,
        array_agg(m.position_fen ORDER BY ABS(m.eval_delta) DESC) as all_fens
    FROM moves m JOIN games g ON m.game_id = g.id
    WHERE m.classification IN ('mistake','blunder') AND m.blunder_category IS NOT NULL AND g.username = 'negrilmannings'
    GROUP BY m.blunder_category, m.phase, m.piece_moved
    LIMIT 1
""")
row = cur.fetchone()
print('fens type:', type(row['all_fens']))
print('fens repr:', repr(row['all_fens'][:120]))
conn.close()
