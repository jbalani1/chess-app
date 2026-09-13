"""Mistake patterns in the Italian Opening, scoped to games the user had White.

Mirrors black_deepdive.py: aggregate tables, plus SEE-verified material drops so
the over-broad `hanging_piece` label isn't taken at face value.
"""
import os
import io
import re
import psycopg2
import chess
import chess.pgn
from collections import Counter, defaultdict
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
USER = 'negrilmannings'
PV = {chess.PAWN: 1, chess.KNIGHT: 3, chess.BISHOP: 3, chess.ROOK: 5, chess.QUEEN: 9}

conn = psycopg2.connect(
    host=os.getenv('SUPABASE_HOST'), port=int(os.getenv('SUPABASE_PORT', 6543)),
    dbname=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'),
    password=os.getenv('SUPABASE_PASSWORD'), sslmode='require',
)
cur = conn.cursor()
P = {'u': USER}

# White-only Italian scope. White's own moves are odd plies.
SCOPE = """
WITH ital AS (
    SELECT id, eco, opening_name, result, played_at, pgn, time_control
    FROM games g
    WHERE g.username = %(u)s
      AND LOWER(g.white_player) = %(u)s
      AND (g.eco IN ('C50','C51','C52','C53','C54','C55','C56','C57','C58','C59')
           OR g.opening_name ILIKE '%%Italian%%'
           OR g.opening_name ILIKE '%%Giuoco%%'
           OR g.opening_name ILIKE '%%Two Knights%%'
           OR g.opening_name ILIKE '%%Evans%%'
           OR g.opening_name ILIKE '%%Hungarian%%')
)
"""
WHITE_MOVE = "AND m.ply %% 2 = 1"


def hdr(t):
    print("\n" + "=" * 78)
    print(t)
    print("=" * 78)


def _val(piece):
    if piece is None:
        return 0
    return 100 if piece.piece_type == chess.KING else PV.get(piece.piece_type, 0)


def _see_square(board, sq):
    caps = [mv for mv in board.legal_moves if mv.to_square == sq and board.is_capture(mv)]
    if not caps:
        return 0
    mv = min(caps, key=lambda m: _val(board.piece_at(m.from_square)))
    victim = _val(board.piece_at(sq))
    board.push(mv)
    gain = max(0, victim - _see_square(board, sq))
    board.pop()
    return gain


def see_capture(board, move):
    victim = 1 if board.is_en_passant(move) else _val(board.piece_at(move.to_square))
    board.push(move)
    net = victim - _see_square(board, move.to_square)
    board.pop()
    return net


# ------------------------------------------------------------------ scope
hdr("SCOPE — Italian Opening as White")
cur.execute(SCOPE + """
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE result='1-0'),
           COUNT(*) FILTER (WHERE result='0-1'),
           COUNT(*) FILTER (WHERE result='1/2-1/2'),
           MIN(played_at)::date, MAX(played_at)::date
    FROM ital
""", P)
n, w, l, d, d0, d1 = cur.fetchone()
print(f"  {n} games  {d0} .. {d1}")
print(f"  W/L/D: {w}/{l}/{d}   score {(w+0.5*d)/n*100:.1f}%")

cur.execute(SCOPE + " SELECT id, pgn, result, eco FROM ital", P)
games = cur.fetchall()


def eco_url_name(pgn):
    m = re.search(r'\[ECOUrl "https?://[^"]*/openings/([^"]+)"\]', pgn)
    return m.group(1).replace('-', ' ') if m else None


opening_of, lines_of = {}, {}
for gid, pgn, result, eco in games:
    opening_of[gid] = eco_url_name(pgn) or '?'
    g = chess.pgn.read_game(io.StringIO(pgn))
    mv, node = [], g
    while g and node.variations and len(mv) < 24:
        node = node.variation(0)
        mv.append(node.san())
    lines_of[gid] = mv

# per-game aggregates on White's moves
cur.execute(SCOPE + """
    SELECT i.id, i.result,
           AVG(LEAST(ABS(m.eval_delta),1000))::int acpl,
           COUNT(*) FILTER (WHERE m.classification='mistake') mis,
           COUNT(*) FILTER (WHERE m.classification='blunder') bl,
           COUNT(*) nmv
    FROM ital i JOIN moves m ON m.game_id=i.id
    WHERE TRUE """ + WHITE_MOVE + """
    GROUP BY i.id, i.result
""", P)
per_game = cur.fetchall()

hdr("PERFORMANCE BY ITALIAN VARIATION (as White)")
agg = defaultdict(lambda: {'n': 0, 'pts': 0.0, 'acpl': 0, 'mv': 0, 'mis': 0, 'bl': 0})
for gid, result, acpl, mis, bl, nmv in per_game:
    k = ' '.join(str(opening_of.get(gid, '?')).split()[:5])
    a = agg[k]
    a['n'] += 1
    a['pts'] += 1.0 if result == '1-0' else (0.5 if result == '1/2-1/2' else 0.0)
    a['acpl'] += acpl * nmv
    a['mv'] += nmv
    a['mis'] += mis
    a['bl'] += bl
print(f"  {'variation':50} {'n':>3} {'score%':>7} {'ACPL':>5} {'mis/g':>6} {'bl/g':>5}")
for k, a in sorted(agg.items(), key=lambda kv: -kv[1]['n']):
    if a['n'] < 3:
        continue
    print(f"  {k[:50]:50} {a['n']:3} {a['pts']/a['n']*100:6.1f}% {a['acpl']/a['mv']:5.0f} "
          f"{a['mis']/a['n']:6.2f} {a['bl']/a['n']:5.2f}")

# ------------------------------------------------------------------ profile
hdr("ERROR PROFILE — White's own moves in the Italian")
cur.execute(SCOPE + """
    SELECT COUNT(*),
           COUNT(*) FILTER (WHERE m.classification='good'),
           COUNT(*) FILTER (WHERE m.classification='inaccuracy'),
           COUNT(*) FILTER (WHERE m.classification='mistake'),
           COUNT(*) FILTER (WHERE m.classification='blunder'),
           AVG(LEAST(ABS(m.eval_delta),1000))::int
    FROM ital i JOIN moves m ON m.game_id=i.id WHERE TRUE """ + WHITE_MOVE, P)
tot, good, inacc, mis, bl, acpl = cur.fetchone()
print(f"  White moves: {tot}   ACPL (capped) {acpl}")
print(f"  good {good/tot*100:.1f}%  inacc {inacc/tot*100:.1f}%  "
      f"mistake {mis/tot*100:.1f}%  blunder {bl/tot*100:.1f}%")
print(f"  per game: {mis/n:.2f} mistakes, {bl/n:.2f} blunders")

print("\n  --- by move-number band ---")
cur.execute(SCOPE + """
    SELECT width_bucket((m.ply+1)/2, 1, 41, 4) band, COUNT(*),
           COUNT(*) FILTER (WHERE m.classification IN ('mistake','blunder')),
           AVG(LEAST(ABS(m.eval_delta),1000))::int
    FROM ital i JOIN moves m ON m.game_id=i.id WHERE TRUE """ + WHITE_MOVE + """
    GROUP BY band ORDER BY band
""", P)
bands = {1: 'moves 1-10', 2: 'moves 11-20', 3: 'moves 21-30', 4: 'moves 31-40', 5: 'move 41+'}
for b, cnt, err, ac in cur.fetchall():
    print(f"  {bands.get(b,'?'):12} moves={cnt:5} errors={err:4} ({err/cnt*100:4.1f}%) ACPL={ac}")

print("\n  --- by piece moved ---")
cur.execute(SCOPE + """
    SELECT m.piece_moved, COUNT(*),
           COUNT(*) FILTER (WHERE m.classification IN ('mistake','blunder'))
    FROM ital i JOIN moves m ON m.game_id=i.id WHERE TRUE """ + WHITE_MOVE + """
    GROUP BY 1 ORDER BY 3 DESC
""", P)
for p, t, e in cur.fetchall():
    print(f"  {p:3} moves={t:5} errors={e:4} ({e/t*100:4.1f}%)")

# ------------------------------------------------------------------ opening-phase repeats
hdr("OPENING-PHASE REPEATS (White, moves 1-15, same move number + SAN, >=3x)")
cur.execute(SCOPE + """
    SELECT (m.ply+1)/2 mv, m.move_san, COUNT(*) n,
           AVG(ABS(m.eval_delta))::int ac,
           COUNT(*) FILTER (WHERE m.classification='blunder') bl,
           array_agg(DISTINCT m.best_move_san) FILTER (WHERE m.best_move_san IS NOT NULL) better
    FROM ital i JOIN moves m ON m.game_id=i.id
    WHERE m.classification IN ('mistake','blunder')
      AND (m.ply+1)/2 <= 15 """ + WHITE_MOVE + """
    GROUP BY 1,2 HAVING COUNT(*) >= 3
    ORDER BY n DESC, ac DESC LIMIT 30
""", P)
for r in cur.fetchall():
    print(f"  move {r[0]:>2}. {r[1]:8} x{r[2]:<3} avg -{r[3]:<5}cp blunders={r[4]}  "
          f"better: {', '.join((r[5] or [])[:3]) or '?'}")

hdr("RECURRING MOVE IDEAS (White, any move number, >=5x)")
cur.execute(SCOPE + """
    SELECT m.move_san, COUNT(*) n, AVG(ABS(m.eval_delta))::int ac,
           COUNT(*) FILTER (WHERE m.classification='blunder') bl,
           MIN((m.ply+1)/2), MAX((m.ply+1)/2)
    FROM ital i JOIN moves m ON m.game_id=i.id
    WHERE m.classification IN ('mistake','blunder') """ + WHITE_MOVE + """
    GROUP BY 1 HAVING COUNT(*) >= 5 ORDER BY n DESC LIMIT 30
""", P)
for r in cur.fetchall():
    print(f"  {r[0]:9} x{r[1]:<3} avg -{r[2]:<5}cp blunders={r[3]:<3} (moves {r[4]}-{r[5]})")

# ------------------------------------------------------------------ Bxf7+ study
hdr("THE Bxf7+ SACRIFICE — every time White played it")
cur.execute(SCOPE + """
    SELECT i.id, (m.ply+1)/2 mv, m.classification, ABS(m.eval_delta) loss,
           -1 * 0 + m.eval_before before_cp, m.eval_after after_cp, m.best_move_san,
           i.result, i.played_at::date
    FROM ital i JOIN moves m ON m.game_id=i.id
    WHERE m.move_san LIKE 'Bxf7%%' """ + WHITE_MOVE + """
    ORDER BY m.ply
""", P)
rows = cur.fetchall()
cnt = Counter(r[2] for r in rows)
print(f"  played {len(rows)} times: " + ', '.join(f"{k or 'unclassified'}={v}" for k, v in cnt.most_common()))
good_ones = [r for r in rows if r[2] == 'good']
bad_ones = [r for r in rows if r[2] in ('mistake', 'blunder')]
print(f"  sound: {len(good_ones)}   unsound (mistake/blunder): {len(bad_ones)}")
print("\n  the unsound ones (eval before -> after, White POV):")
for r in bad_ones:
    print(f"    mv {r[1]:>2}  {r[2]:8} -{r[3]:<5}cp   {r[4]:+5} -> {r[5]:+5}  "
          f"better: {r[6] or '?':7}  game result {r[7]}  {r[8]}")

print("\n  lines leading into the unsound sacs (first 12 plies):")
seen = set()
for r in bad_ones:
    if r[0] in seen:
        continue
    seen.add(r[0])
    print(f"    mv{r[1]:>2} [{r[7]}] " + ' '.join(lines_of.get(r[0], [])[:12]))

# ------------------------------------------------------------------ centre handling
hdr("CENTRE HANDLING — the c3/d4 pawn centre")
cur.execute(SCOPE + """
    SELECT m.move_san, COUNT(*) n, AVG(ABS(m.eval_delta))::int ac,
           COUNT(*) FILTER (WHERE m.classification='blunder') bl,
           array_agg(DISTINCT m.best_move_san) FILTER (WHERE m.best_move_san IS NOT NULL) better
    FROM ital i JOIN moves m ON m.game_id=i.id
    WHERE m.classification IN ('mistake','blunder')
      AND m.move_san IN ('cxd4','dxe5','dxc3','exd5','d4','d5','e5','cxd5','Nxd4','Qxd4','cxb4')
      """ + WHITE_MOVE + """
    GROUP BY 1 ORDER BY n DESC
""", P)
for r in cur.fetchall():
    print(f"  {r[0]:7} x{r[1]:<3} avg -{r[2]:<5}cp blunders={r[3]:<3} "
          f"better: {', '.join((r[4] or [])[:4]) or '?'}")

print("\n  --- when the centre resolves: eval swing at moves 8-16 ---")
cur.execute(SCOPE + """
    SELECT (m.ply+1)/2 mv, COUNT(*) n, AVG(m.eval_after)::int cp,
           COUNT(*) FILTER (WHERE m.classification IN ('mistake','blunder')) err
    FROM ital i JOIN moves m ON m.game_id=i.id
    WHERE (m.ply+1)/2 BETWEEN 6 AND 18 """ + WHITE_MOVE + """
    GROUP BY 1 ORDER BY 1
""", P)
print("  move  n   avg eval (White POV)  errors")
for mvno, cnt, cp, err in cur.fetchall():
    print(f"  {mvno:4} {cnt:3}   {cp:+6}cp             {err:3} ({err/cnt*100:4.1f}%)")

# ------------------------------------------------------------------ SEE drops
hdr("MATERIAL DROPS IN THE ITALIAN (SEE-verified, White's moves)")
cur.execute(SCOPE + """
    SELECT i.id, m.ply, m.move_san, m.move_uci, m.position_fen_before,
           m.classification, m.phase, m.best_move_san, m.eval_before
    FROM ital i JOIN moves m ON m.game_id=i.id
    WHERE m.classification IN ('mistake','blunder')
      AND m.position_fen_before IS NOT NULL """ + WHITE_MOVE + """
""", P)
errs = cur.fetchall()
replies = {}
for gid, pgn, result, eco in games:
    g = chess.pgn.read_game(io.StringIO(pgn))
    node, ply = g, 0
    while g and node.variations:
        node = node.variation(0)
        ply += 1
        replies[(gid, ply)] = node.san()

drops, sizes, by_phase, opening_drops = [], Counter(), Counter(), []
punished = 0
onepawn = 0
for gid, ply, san, uci, fen, cls, phase, best, before in errs:
    try:
        b = chess.Board(fen)
        b.push(chess.Move.from_uci(uci))
    except Exception:
        continue
    bg, bc = 0, None
    for mv in b.legal_moves:
        if b.is_capture(mv):
            g2 = see_capture(b, mv)
            if g2 > bg:
                bg, bc = g2, b.san(mv)
    if bg >= 2:
        drops.append((gid, ply, san, bc, bg, phase, best, before))
        sizes[bg] += 1
        by_phase[phase] += 1
        punished += replies.get((gid, ply + 1)) == bc
        if (ply + 1) // 2 <= 15:
            opening_drops.append((ply, san, bc, bg, best, before))
    elif bg == 1:
        onepawn += 1

print(f"  error moves examined: {len(errs)}")
print(f"  left >= 2 pawns of free material: {len(drops)} ({len(drops)/max(len(errs),1)*100:.0f}%)"
      f"   -- opponent took it {punished}/{len(drops)} ({punished/max(len(drops),1)*100:.0f}%)")
print(f"  dropped exactly 1 pawn:          {onepawn}")
print("  sizes: " + ', '.join(f"{k}p x{v}" for k, v in sorted(sizes.items(), reverse=True)))
print("  by phase: " + ', '.join(f"{k} x{v}" for k, v in by_phase.most_common()))

print(f"\n  drops inside the opening (moves 1-15): {len(opening_drops)}")
for ply, san, cap, gain, best, before in sorted(opening_drops, key=lambda x: -x[3])[:20]:
    print(f"    mv {(ply+1)//2:>2}. {san:8} -> {cap:8} wins {gain:2}p   "
          f"was {before:+5}cp  better: {best or '?'}")

conn.close()
print("\ndone.")
