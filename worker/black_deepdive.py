"""Deep dive on the last 50 Black games.

Two things the aggregate tables can't answer:
  1. Did the error actually *drop material*? Verified with static exchange
     evaluation rather than trusting the over-broad `hanging_piece` label.
  2. Conversion: how often does a won/better position fail to become a win?
"""
import os
import io
import psycopg2
import chess
import chess.pgn
from collections import Counter, defaultdict
from dotenv import load_dotenv
from see import avoidable_drop
import scope

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
USER = 'negrilmannings'
N = 50
PV = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}

conn = psycopg2.connect(
    host=os.getenv('SUPABASE_HOST'), port=int(os.getenv('SUPABASE_PORT', 6543)),
    dbname=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'),
    password=os.getenv('SUPABASE_PASSWORD'), sslmode='require',
)
cur = conn.cursor()
P = scope.PARAMS
SCOPE = "WITH last50 AS (" + scope.LAST_BLACK + ")"


def hdr(t):
    print("\n" + "=" * 78)
    print(t)
    print("=" * 78)


# ------------------------------------------------------------------ conversion
hdr("CONVERSION — what happens to good positions")
cur.execute(SCOPE + """
    SELECT l.id, l.result,
           MAX(-m.eval_after) FILTER (WHERE ABS(m.eval_after) < 9000) best_cp,
           MIN(-m.eval_after) FILTER (WHERE ABS(m.eval_after) < 9000) worst_cp
    FROM last50 l JOIN moves m ON m.game_id=l.id
    GROUP BY l.id, l.result
""", P)
rows = cur.fetchall()
buckets = defaultdict(lambda: Counter())
for gid, result, best, worst in rows:
    if best is None:
        continue
    if best >= 300:
        b = 'reached +3.00 or more (winning)'
    elif best >= 100:
        b = 'reached +1.00..+3.00 (clearly better)'
    elif best >= -50:
        b = 'never better than +1.00'
    else:
        b = 'never equal'
    buckets[b][result] += 1
    buckets[b]['n'] += 1

for b in ['reached +3.00 or more (winning)', 'reached +1.00..+3.00 (clearly better)',
          'never better than +1.00', 'never equal']:
    c = buckets.get(b)
    if not c:
        continue
    n = c['n']
    print(f"  {b:40} n={n:3}  won {c['0-1']:2}  lost {c['1-0']:2}  drew {c['1/2-1/2']:2}"
          f"   ({c['0-1']/n*100:.0f}% converted)")

# the reverse: how often does Black survive a bad position
lost_won = [r for r in rows if r[2] is not None and r[2] >= 300 and r[1] == '1-0']
print(f"\n  games where Black reached +3.00 (winning) and still LOST: {len(lost_won)}")
saved = [r for r in rows if r[3] is not None and r[3] <= -300 and r[1] == '0-1']
print(f"  games where Black was -3.00 (losing) and still WON:    {len(saved)}")

# ------------------------------------------------------------------ SEE check
hdr("MATERIAL DROPS — verified by static exchange evaluation")
cur.execute(SCOPE + """
    SELECT l.id, l.result, m.ply, m.move_san, m.move_uci, m.position_fen_before,
           m.classification, ABS(m.eval_delta) loss, m.phase, m.best_move_san,
           m.blunder_category, -m.eval_before before_cp
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE m.classification IN ('mistake','blunder')
      AND m.ply %% 2 = 0
      AND m.position_fen_before IS NOT NULL
    ORDER BY l.played_at DESC, m.ply
""", P)
errs = cur.fetchall()
print(f"  error moves with a stored position: {len(errs)}")

# opponent's actual reply, from the PGN
cur.execute(SCOPE + " SELECT id, pgn FROM last50", P)
replies = {}
for gid, pgn in cur.fetchall():
    game = chess.pgn.read_game(io.StringIO(pgn))
    if not game:
        continue
    node, ply = game, 0
    while node.variations:
        node = node.variation(0)
        ply += 1
        replies[(gid, ply)] = node.san()

dropped = Counter()          # piece dropped -> count
drop_rows = []
punished = 0
free_hang = 0                # piece could be taken for nothing at all
for (gid, result, ply, san, uci, fen, cls, loss, phase, best, cat, before_cp) in errs:
    try:
        board = chess.Board(fen)
        move = chess.Move.from_uci(uci)
    except Exception:
        continue
    # material this move gave away that another legal move would have saved
    best_gain, best_cap, _gross, _floor = avoidable_drop(board, move)
    if best_gain >= 2:              # at least a minor-piece-worth of free material
        dropped[best_gain] += 1
        actual = replies.get((gid, ply + 1))
        took = actual == best_cap
        punished += took
        drop_rows.append((ply, san, best_cap, best_gain, took, phase, best, before_cp, loss))
    elif best_gain == 1:
        free_hang += 1

print(f"  moves that avoidably dropped >= 2 pawns          : {len(drop_rows)}"
      f"  ({len(drop_rows)/max(len(errs),1)*100:.0f}% of error moves)")
print(f"  moves that avoidably dropped 1 pawn:                 {free_hang}")
print(f"  of the >=2-pawn drops, opponent took it:             {punished}/{len(drop_rows)}"
      f" ({punished/max(len(drop_rows),1)*100:.0f}%)")
print("\n  size of material dropped (pawn-equivalents):")
for v in sorted(dropped, reverse=True):
    print(f"    {v:2} pawns  x{dropped[v]}")

print("\n  by phase:")
ph = Counter(r[5] for r in drop_rows)
for k, v in ph.most_common():
    print(f"    {k:11} x{v}")

print("\n  drops made FROM a better position (Black was +1.00 or more):")
from_good = [r for r in drop_rows if r[7] is not None and r[7] > 100]
print(f"    {len(from_good)} of {len(drop_rows)}")

print("\n  worst 25 drops (move, what was hung, punished?):")
for r in sorted(drop_rows, key=lambda x: -x[3])[:25]:
    ply, san, cap, gain, took, phase, best, before_cp, loss = r
    print(f"    mv {(ply+1)//2:>2}. {san:8} -> {cap:8} wins {gain:2}p  "
          f"{'TAKEN' if took else 'missed by opp':13} {phase:11} "
          f"was {before_cp if before_cp is not None else 0:+5}cp  better: {best or '?'}")

# ------------------------------------------------------------------ endgames
hdr("ENDGAME — 197 moves, 45 blunders")
cur.execute(SCOPE + """
    SELECT m.piece_moved, COUNT(*) tot,
           COUNT(*) FILTER (WHERE m.classification IN ('mistake','blunder')) err
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE m.phase='endgame' AND m.ply %% 2 = 0
    GROUP BY 1 ORDER BY err DESC
""", P)
for p, t, e in cur.fetchall():
    print(f"  {p:3} moves={t:4} errors={e:3} ({e/t*100:4.1f}%)")

cur.execute(SCOPE + """
    SELECT COUNT(DISTINCT l.id) FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE m.phase='endgame'
""", P)
print(f"  games that reached an endgame (ply>80): {cur.fetchone()[0]}")

# ------------------------------------------------------------------ open games
hdr("THE OPEN-GAME PROBLEM — d4-early lines vs slow Italian/Ruy lines")
cur.execute(SCOPE + """
    SELECT CASE
             WHEN l.eco IN ('C21','C22','C44','C45','C46','C47','C48','C49') THEN 'early d4 / Knights (Scotch, Center, Danish, 3-4 Knights)'
             WHEN l.eco BETWEEN 'C50' AND 'C59' THEN 'Italian complex (C50-C59)'
             WHEN l.eco BETWEEN 'C60' AND 'C99' THEN 'Ruy Lopez (C60-C99)'
             WHEN l.eco BETWEEN 'C20' AND 'C29' THEN 'Vienna / Bishops / KP side lines (C20-C29)'
             WHEN l.eco BETWEEN 'C30' AND 'C39' THEN 'Kings Gambit (C30-C39)'
             WHEN l.eco LIKE 'D%%' OR l.eco LIKE 'E%%' OR l.eco LIKE 'A%%' THEN 'vs 1.d4 / flank'
             ELSE 'other'
           END grp,
           COUNT(DISTINCT l.id) n,
           COUNT(DISTINCT l.id) FILTER (WHERE l.result='0-1') w,
           COUNT(DISTINCT l.id) FILTER (WHERE l.result='1/2-1/2') d,
           AVG(LEAST(ABS(m.eval_delta),1000))::int acpl,
           COUNT(*) FILTER (WHERE m.classification='blunder') bl,
           COUNT(*) FILTER (WHERE m.classification IN ('mistake','blunder'))::float
             / NULLIF(COUNT(*),0) * 100 err
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE m.ply %% 2 = 0
    GROUP BY grp ORDER BY n DESC
""", P)
print(f"  {'group':56} {'n':>3} {'score%':>7} {'ACPL':>5} {'bl/g':>5} {'err%':>5}")
for grp, n, w, d, acpl, bl, err in cur.fetchall():
    print(f"  {grp:56} {n:3} {(w+0.5*d)/n*100:6.1f}% {acpl:5} {bl/n:5.1f} {err:5.1f}")

# eval at move 12 by that grouping
cur.execute(SCOPE + """
    SELECT CASE
             WHEN l.eco IN ('C21','C22','C44','C45','C46','C47','C48','C49') THEN 'early d4 / Knights'
             WHEN l.eco BETWEEN 'C50' AND 'C59' THEN 'Italian complex'
             WHEN l.eco BETWEEN 'C60' AND 'C99' THEN 'Ruy Lopez'
             WHEN l.eco BETWEEN 'C20' AND 'C29' THEN 'Vienna / Bishops'
             WHEN l.eco BETWEEN 'C30' AND 'C39' THEN 'Kings Gambit'
             ELSE 'vs 1.d4 / flank'
           END grp,
           COUNT(*) n, AVG(-m.eval_after)::int cp
    FROM last50 l JOIN moves m ON m.game_id=l.id AND m.ply=24
    GROUP BY grp ORDER BY cp
""", P)
print("\n  Black-POV eval after move 12:")
for grp, n, cp in cur.fetchall():
    print(f"    {grp:26} n={n:2}  {cp:+5}cp")

conn.close()
print("\ndone.")
