"""Apply db/explorer_schema.sql and backfill the derived columns it adds.

Safe to re-run: every write is idempotent and only touches rows whose value
would change. Pass --force to recompute everything.
"""
import io
import os
import re
import sys
import chess
import chess.pgn
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv
from see import avoidable_drop

HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(HERE, '.env'))
SCHEMA = os.path.join(HERE, '..', 'db', 'explorer_schema.sql')
FORCE = '--force' in sys.argv

conn = psycopg2.connect(
    host=os.getenv('SUPABASE_HOST'), port=int(os.getenv('SUPABASE_PORT', 6543)),
    dbname=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'),
    password=os.getenv('SUPABASE_PASSWORD'), sslmode='require')
conn.autocommit = False
cur = conn.cursor()


def step(msg):
    print(f'\n== {msg}')


def split_statements(sql):
    """Split on semicolons, ignoring those inside $$-quoted function bodies.

    Leading comment lines are stripped rather than used to classify the
    statement — a commented statement is still a statement.
    """
    out, buf, in_dollar = [], [], False
    for line in sql.splitlines():
        if line.count('$$') % 2 == 1:
            in_dollar = not in_dollar
        buf.append(line)
        if not in_dollar and line.rstrip().endswith(';'):
            body = [l for l in buf if not l.strip().startswith('--')]
            stmt = '\n'.join(body).strip()
            if stmt:
                out.append(stmt)
            buf = []
    tail = '\n'.join(l for l in buf if not l.strip().startswith('--')).strip()
    if tail:
        out.append(tail)
    return out


def run_ddl(path):
    """Run a .sql file one statement at a time.

    The connection goes through Supabase's transaction pooler, which resets
    session state on every commit — so a plain `SET statement_timeout` is gone
    by the next statement. SET LOCAL inside each transaction survives where it
    is actually needed.
    """
    with open(path) as fh:
        statements = split_statements(fh.read())
    for i, stmt in enumerate(statements, 1):
        head = ' '.join(stmt.split())[:68]
        try:
            cur.execute("SET LOCAL statement_timeout = '600s'")
            cur.execute(stmt)
            conn.commit()
            print(f'   [{i}/{len(statements)}] {head}')
        except Exception as e:
            conn.rollback()
            print(f'   [{i}/{len(statements)}] FAILED {head}\n       {e}')
            raise


step('applying schema')
run_ddl(SCHEMA)

# ---------------------------------------------------------------- games
step('backfilling game-level columns')
cur.execute("""
    SELECT id, username, white_player, black_player, pgn, opening_name
    FROM games
    WHERE %s OR user_color IS NULL OR opening_clean IS NULL OR vs_first_move IS NULL
""", (FORCE,))
games = cur.fetchall()
print(f'   {len(games)} games to process')


def eco_url_name(pgn):
    m = re.search(r'\[ECOUrl "https?://[^"]*/openings/([^"]+)"\]', pgn or '')
    return m.group(1).replace('-', ' ') if m else None


updates = []
for gid, username, white, black, pgn, opening_name in games:
    color = 'white' if (white or '').lower() == (username or '').lower() else 'black'
    clean = eco_url_name(pgn)
    if not clean or clean == '?':
        clean = None if (opening_name in (None, '', 'Unknown')) else opening_name
    family = ' '.join(clean.split()[:3]) if clean else None

    first_white = first_reply = None
    try:
        game = chess.pgn.read_game(io.StringIO(pgn))
        if game is not None:
            node, sans = game, []
            while node.variations and len(sans) < 2:
                node = node.variation(0)
                sans.append(node.san())
            if sans:
                first_white = sans[0]
                # what the user answered with: Black's 1st reply, or White's own
                # first move when the user had White
                first_reply = sans[0] if color == 'white' else (
                    sans[1] if len(sans) > 1 else None)
    except Exception:
        pass

    updates.append((color, clean, family, first_white, first_reply, gid))

psycopg2.extras.execute_batch(cur, """
    UPDATE games SET user_color=%s, opening_clean=%s, opening_family=%s,
                     vs_first_move=%s, user_reply=%s
    WHERE id=%s
""", updates, page_size=500)
conn.commit()
print(f'   updated {len(updates)} games')

# ---------------------------------------------------------------- moves: flags
step('backfilling move flags (is_user_move, is_real_error, eval_before_user)')
# Odd ply = White's move. eval_before is White-centric, so a Black player's
# own-POV edge is its negation.
cur.execute("""
    UPDATE moves m
    SET is_user_move = CASE WHEN g.user_color = 'white'
                            THEN (m.ply %% 2 = 1) ELSE (m.ply %% 2 = 0) END,
        eval_before_user = CASE WHEN g.user_color = 'white'
                                THEN m.eval_before ELSE -m.eval_before END
    FROM games g
    WHERE g.id = m.game_id
      AND (%s OR m.is_user_move IS NULL OR m.eval_before_user IS NULL)
""", (FORCE,))
print(f'   {cur.rowcount} move rows flagged')

cur.execute("""
    UPDATE moves
    SET is_real_error = (classification IN ('mistake','blunder')
                         AND eval_delta IS NOT NULL AND eval_delta < 0)
    WHERE %s OR is_real_error IS NULL
""", (FORCE,))
print(f'   {cur.rowcount} rows classified')
conn.commit()

# ---------------------------------------------------------------- moves: SEE
step('computing avoidable material loss on your error moves')
cur.execute("""
    SELECT m.id, m.move_uci, m.position_fen_before
    FROM moves m
    WHERE m.is_user_move AND m.is_real_error
      AND m.position_fen_before IS NOT NULL
      AND (%s OR m.avoidable_loss IS NULL)
""", (FORCE,))
targets = cur.fetchall()
print(f'   {len(targets)} error moves to evaluate')

rows, skipped = [], 0
for i, (mid, uci, fen) in enumerate(targets, 1):
    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(uci)
        if move not in board.legal_moves:
            skipped += 1
            continue
        marginal, _cap, _gross, _floor = avoidable_drop(board, move)
    except Exception:
        skipped += 1
        continue
    rows.append((int(marginal), mid))
    if i % 500 == 0:
        print(f'   {i}/{len(targets)}')

psycopg2.extras.execute_batch(
    cur, "UPDATE moves SET avoidable_loss=%s WHERE id=%s", rows, page_size=500)
conn.commit()
print(f'   wrote {len(rows)} values ({skipped} skipped)')

# rows we could not evaluate get 0 rather than NULL so filters behave
cur.execute("""
    UPDATE moves SET avoidable_loss = 0
    WHERE is_user_move AND is_real_error AND avoidable_loss IS NULL
""")
conn.commit()

# ---------------------------------------------------------------- summary
step('summary')
cur.execute("""
    SELECT user_color, COUNT(*) FROM games GROUP BY 1 ORDER BY 2 DESC
""")
print('   games by colour: ' + ', '.join(f'{c}={n}' for c, n in cur.fetchall()))

cur.execute("SELECT COUNT(*) FROM user_mistakes")
print(f'   user_mistakes view rows: {cur.fetchone()[0]}')

cur.execute("""
    SELECT edge_bucket, COUNT(*) FROM user_mistakes GROUP BY 1 ORDER BY 2 DESC
""")
print('   by edge: ' + ', '.join(f'{b}={n}' for b, n in cur.fetchall()))

cur.execute("""
    SELECT vs_first_move, user_color, COUNT(*) FROM user_mistakes
    GROUP BY 1,2 ORDER BY 3 DESC LIMIT 8
""")
print('   top (first move, colour):')
for fm, col, n in cur.fetchall():
    print(f'     {fm or "?":5} as {col:5} {n}')

cur.execute("SELECT COUNT(*) FROM user_mistakes WHERE avoidable_loss >= 2")
print(f'   errors that dropped >=2 pawns avoidably: {cur.fetchone()[0]}')

conn.close()
print('\ndone.')
