"""Zoom in on the two recurring Italian problem spots: the ...Bb4+ check after
cxd4, and the move-9 Re1."""
import os
import io
import psycopg2
import chess
import chess.pgn
from collections import Counter, defaultdict
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
USER = 'negrilmannings'

conn = psycopg2.connect(
    host=os.getenv('SUPABASE_HOST'), port=int(os.getenv('SUPABASE_PORT', 6543)),
    dbname=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'),
    password=os.getenv('SUPABASE_PASSWORD'), sslmode='require',
)
cur = conn.cursor()
cur.execute("""
    SELECT id, pgn, result FROM games
    WHERE username=%s AND LOWER(white_player)=%s
      AND (eco IN ('C50','C51','C52','C53','C54','C55','C56','C57','C58','C59')
           OR opening_name ILIKE '%%Italian%%' OR opening_name ILIKE '%%Giuoco%%'
           OR opening_name ILIKE '%%Two Knights%%')
""", (USER, USER))
games = cur.fetchall()

lines = {}
for gid, pgn, result in games:
    g = chess.pgn.read_game(io.StringIO(pgn))
    mv, node = [], g
    while g and node.variations and len(mv) < 40:
        node = node.variation(0)
        mv.append(node.san())
    lines[gid] = (mv, result)

print("=" * 78)
print("A) The ...Bb4+ check after c3/d4/cxd4 — how White answers it")
print("=" * 78)
resp = defaultdict(lambda: [0, 0.0])
examples = defaultdict(list)
for gid, (mv, result) in lines.items():
    for i, san in enumerate(mv):
        if san in ('Bb4+', 'Bb4') and i % 2 == 1 and i >= 8:
            if i + 1 < len(mv):
                r = mv[i + 1]
                resp[r][0] += 1
                resp[r][1] += 1.0 if result == '1-0' else (0.5 if result == '1/2-1/2' else 0.0)
                examples[r].append((gid, ' '.join(mv[:i + 4])))
            break
tot = sum(v[0] for v in resp.values())
print(f"  games reaching a ...Bb4(+) check after move 4: {tot}")
print(f"  {'White reply':10} {'n':>3} {'score%':>7}")
for r, (n, p) in sorted(resp.items(), key=lambda kv: -kv[1][0]):
    print(f"  {r:10} {n:3} {p/n*100:6.1f}%")
print("\n  sample lines:")
for r, (n, p) in sorted(resp.items(), key=lambda kv: -kv[1][0])[:4]:
    print(f"    after {r}: " + examples[r][0][1])

print("\n" + "=" * 78)
print("B) Move-9 Re1 — the positions it was played in")
print("=" * 78)
cur.execute("""
    SELECT g.id, (m.ply+1)/2, m.classification, ABS(m.eval_delta), m.eval_before,
           m.eval_after, m.best_move_san, g.result
    FROM games g JOIN moves m ON m.game_id=g.id
    WHERE g.username=%s AND LOWER(g.white_player)=%s
      AND m.move_san='Re1' AND m.ply %% 2 = 1
      AND m.classification IN ('mistake','blunder')
      AND (m.ply+1)/2 BETWEEN 8 AND 12
      AND (g.eco LIKE 'C5%%' OR g.opening_name ILIKE '%%Italian%%'
           OR g.opening_name ILIKE '%%Giuoco%%')
    ORDER BY ABS(m.eval_delta) DESC
""", (USER, USER))
for gid, mvno, cls, loss, eb, ea, best, result in cur.fetchall():
    mv = lines.get(gid, ([], ''))[0]
    print(f"  mv{mvno:>2} {cls:8} -{loss:<4}cp {eb:+5}->{ea:+5} better:{best or '?':7} [{result}]")
    print(f"       " + ' '.join(mv[:2 * mvno]))

print("\n" + "=" * 78)
print("C) Black's setups against the Italian — which give White the most trouble")
print("=" * 78)
setups = defaultdict(lambda: [0, 0.0])
for gid, (mv, result) in lines.items():
    if len(mv) < 6:
        continue
    key = mv[5] if len(mv) > 5 else '?'      # Black's 3rd move (reply to Bc4)
    setups[key][0] += 1
    setups[key][1] += 1.0 if result == '1-0' else (0.5 if result == '1/2-1/2' else 0.0)
print(f"  {'Black 3rd move':16} {'n':>3} {'White score%':>13}")
for k, (n, p) in sorted(setups.items(), key=lambda kv: -kv[1][0]):
    if n >= 3:
        print(f"  {k:16} {n:3} {p/n*100:12.1f}%")

print("\n  --- White's 4th move choice and how it scores ---")
choice = defaultdict(lambda: [0, 0.0])
for gid, (mv, result) in lines.items():
    if len(mv) < 8:
        continue
    key = f"{mv[5]} / {mv[6]}"
    choice[key][0] += 1
    choice[key][1] += 1.0 if result == '1-0' else (0.5 if result == '1/2-1/2' else 0.0)
print(f"  {'Black 3rd / White 4th':24} {'n':>3} {'score%':>8}")
for k, (n, p) in sorted(choice.items(), key=lambda kv: -kv[1][0]):
    if n >= 4:
        print(f"  {k:24} {n:3} {p/n*100:7.1f}%")

print("\n  --- d3 (slow) vs d4 (sharp) as White's plan ---")
plan = defaultdict(lambda: [0, 0.0])
for gid, (mv, result) in lines.items():
    white = [m for i, m in enumerate(mv[:20]) if i % 2 == 0]
    if 'd4' in white and white.index('d4') <= 8:
        k = 'played d4 early (sharp centre)'
    elif 'd3' in white:
        k = 'played d3 (slow / Pianissimo)'
    else:
        k = 'neither in first 10 moves'
    plan[k][0] += 1
    plan[k][1] += 1.0 if result == '1-0' else (0.5 if result == '1/2-1/2' else 0.0)
for k, (n, p) in sorted(plan.items(), key=lambda kv: -kv[1][0]):
    print(f"  {k:34} n={n:3}  score {p/n*100:5.1f}%")

conn.close()
