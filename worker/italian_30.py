"""Analyse the last 30 Italian games as White, including inaccuracies.

Tests three specific hypotheses the user raised, by replaying every position
rather than pattern-matching on move names:

  1. pinned knights   - detect a real pin with python-chess, then ask what the
                        user did about it and what it cost
  2. queen development - when the queen comes out, and what that costs
  3. central captures  - captures on the four centre squares and the ring
                        around them

Writes reports/italian30/analysis.json for the PDF builder.
"""
import io
import json
import os
import re
from collections import Counter, defaultdict
from statistics import median

import chess
import chess.pgn
import psycopg2
from dotenv import load_dotenv

from see import avoidable_drop

HERE = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(HERE, '.env'))
OUT = os.path.join(HERE, 'reports', 'italian30')
os.makedirs(OUT, exist_ok=True)

USER = 'negrilmannings'
N_GAMES = 30
CENTRE = {chess.D4, chess.E4, chess.D5, chess.E5}
BIG_CENTRE = CENTRE | {chess.C4, chess.C5, chess.F4, chess.F5,
                       chess.D3, chess.E3, chess.D6, chess.E6}

conn = psycopg2.connect(
    host=os.getenv('SUPABASE_HOST'), port=int(os.getenv('SUPABASE_PORT', 6543)),
    dbname=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'),
    password=os.getenv('SUPABASE_PASSWORD'), sslmode='require')
cur = conn.cursor()

ITALIAN = """
    g.username = %(u)s AND LOWER(g.white_player) = %(u)s
    AND (g.eco IN ('C50','C51','C52','C53','C54','C55','C56','C57','C58','C59')
         OR g.opening_clean ILIKE '%%Italian%%'
         OR g.opening_clean ILIKE '%%Giuoco%%'
         OR g.opening_clean ILIKE '%%Two Knights%%')
"""

cur.execute(f"""
    SELECT g.id::text, g.pgn, g.result, g.played_at::date::text,
           g.black_player, g.opening_clean, g.time_control
    FROM games g WHERE {ITALIAN}
    ORDER BY g.played_at DESC LIMIT %(n)s
""", {'u': USER, 'n': N_GAMES})
games = cur.fetchall()
game_ids = [g[0] for g in games]
print(f'{len(games)} Italian games as White: {games[-1][3]} .. {games[0][3]}')

# Every analysed move of the user's in those games, inaccuracies included.
cur.execute("""
    SELECT m.game_id::text, m.ply, m.move_san, m.move_uci, m.position_fen_before,
           m.best_move_san, m.best_move_uci, m.classification::text,
           m.eval_before, m.eval_after, m.eval_delta, m.piece_moved, m.phase::text
    FROM moves m
    WHERE m.game_id = ANY(%s::uuid[]) AND m.ply %% 2 = 1
      AND m.position_fen_before IS NOT NULL
    ORDER BY m.game_id, m.ply
""", (game_ids,))
moves = cur.fetchall()
conn.close()

meta = {g[0]: {'result': g[2], 'date': g[3], 'opp': g[4],
               'opening': g[5], 'tc': g[6]} for g in games}
links = {}
for gid, pgn, *_ in games:
    m = re.search(r'\[Link "([^"]+)"\]', pgn or '')
    links[gid] = m.group(1) if m else None

ERRORS = ('inaccuracy', 'mistake', 'blunder')
errs = [m for m in moves if m[7] in ERRORS and m[10] is not None and m[10] < 0]
print(f'{len(moves)} of your moves analysed; {len(errs)} are inaccuracy or worse')

records = []
for (gid, ply, san, uci, fen, best_san, best_uci, cls,
     eb, ea, delta, piece, phase) in errs:
    try:
        board = chess.Board(fen)
        mv = chess.Move.from_uci(uci)
        if mv not in board.legal_moves:
            continue
    except Exception:
        continue

    # ---- was one of our knights pinned when we moved? --------------------
    pinned_knights = [sq for sq in board.pieces(chess.KNIGHT, chess.WHITE)
                      if board.is_pinned(chess.WHITE, sq)]
    # did this move resolve the pin?
    after = board.copy()
    after.push(mv)
    still_pinned = [sq for sq in after.pieces(chess.KNIGHT, chess.WHITE)
                    if after.is_pinned(chess.WHITE, sq)]

    # ---- capture on or near the centre? ----------------------------------
    is_cap = board.is_capture(mv)
    to_sq = mv.to_square
    cap_zone = ('centre' if is_cap and to_sq in CENTRE
                else 'near-centre' if is_cap and to_sq in BIG_CENTRE
                else 'elsewhere' if is_cap else None)

    # ---- queen move, and how early? --------------------------------------
    moveno = (ply + 1) // 2
    is_queen = piece == 'Q'
    queen_sq = next(iter(board.pieces(chess.QUEEN, chess.WHITE)), None)
    queen_home = queen_sq == chess.D1

    marginal, cap_san, gross, floor = avoidable_drop(board, mv)

    records.append({
        'game_id': gid, 'ply': ply, 'move_no': moveno,
        'san': san, 'uci': uci, 'fen': fen,
        'best_san': best_san, 'best_uci': best_uci,
        'cls': cls, 'eval_before': eb, 'eval_after': ea,
        'cp_lost': abs(delta), 'piece': piece, 'phase': phase,
        'knight_pinned': bool(pinned_knights),
        'pin_unresolved': bool(pinned_knights) and bool(still_pinned),
        'capture_zone': cap_zone,
        'is_queen_move': is_queen,
        'queen_left_home': is_queen and queen_home,
        'material_lost': marginal,
        'opp': meta[gid]['opp'], 'date': meta[gid]['date'],
        'result': meta[gid]['result'], 'url': links.get(gid),
    })

# ---------------------------------------------------------------- summary
CAP = 1000  # 10 pawns: beyond this the engine is reporting a mate, not material


def capped_avg(rows):
    return round(sum(min(r['cp_lost'], CAP) for r in rows) / max(len(rows), 1))


def med(rows):
    return round(median([r['cp_lost'] for r in rows])) if rows else 0


def pct(a, b):
    return round(100.0 * a / b, 1) if b else 0.0


total_moves = len(moves)
by_cls = Counter(r['cls'] for r in records)
wins = sum(1 for g in games if g[2] == '1-0')
draws = sum(1 for g in games if g[2] == '1/2-1/2')

# -- theme 1: pinned knights
pin_moves = [m for m in moves
             if m[4] and chess.Board(m[4]).pieces(chess.KNIGHT, chess.WHITE)]
pin_positions = 0
pin_errors = [r for r in records if r['knight_pinned']]
for m in moves:
    try:
        b = chess.Board(m[4])
    except Exception:
        continue
    if any(b.is_pinned(chess.WHITE, sq) for sq in b.pieces(chess.KNIGHT, chess.WHITE)):
        pin_positions += 1

# -- theme 2: queen
queen_moves = [m for m in moves if m[11] == 'Q']
queen_errs = [r for r in records if r['is_queen_move']]
early_queen = [r for r in queen_errs if r['move_no'] <= 12]

# -- theme 3: central captures
cap_moves = [m for m in moves
             if m[4] and chess.Board(m[4]).is_capture(chess.Move.from_uci(m[3]))]
centre_caps = [m for m in cap_moves
               if chess.Move.from_uci(m[3]).to_square in BIG_CENTRE]
centre_cap_errs = [r for r in records if r['capture_zone'] in ('centre', 'near-centre')]

summary = {
    'games': len(games),
    'span': [games[-1][3], games[0][3]],
    'record': {'w': wins, 'd': draws, 'l': len(games) - wins - draws},
    'score_pct': pct(wins + 0.5 * draws, len(games)),
    'moves_analysed': total_moves,
    'errors': len(records),
    'error_rate': pct(len(records), total_moves),
    'by_class': dict(by_cls),
    'per_game': round(len(records) / len(games), 1),
    'themes': {
        'pinned_knight': {
            'positions_with_pin': pin_positions,
            'errors': len(pin_errors),
            'error_rate': pct(len(pin_errors), pin_positions),
            'unresolved': sum(1 for r in pin_errors if r['pin_unresolved']),
            'avg_cp': capped_avg(pin_errors), 'median_cp': med(pin_errors),
        },
        'queen': {
            'queen_moves': len(queen_moves),
            'errors': len(queen_errs),
            'error_rate': pct(len(queen_errs), len(queen_moves)),
            'early': len(early_queen),
            'avg_cp': capped_avg(queen_errs), 'median_cp': med(queen_errs),
        },
        'central_capture': {
            'captures': len(cap_moves),
            'central_captures': len(centre_caps),
            'errors': len(centre_cap_errs),
            'error_rate': pct(len(centre_cap_errs), max(len(centre_caps), 1)),
            'avg_cp': capped_avg(centre_cap_errs), 'median_cp': med(centre_cap_errs),
            'mate_scale': sum(1 for r in centre_cap_errs if r['cp_lost'] > 3000),
        },
    },
}

# error rate by move number, for the chart
band = defaultdict(lambda: [0, 0])
for m in moves:
    band[min(((m[1] + 1) // 2 - 1) // 5 * 5 + 5, 40)][1] += 1
for r in records:
    band[min((r['move_no'] - 1) // 5 * 5 + 5, 40)][0] += 1
summary['by_move_band'] = [
    {'band': f'{k-4}–{k}', 'errors': v[0], 'moves': v[1], 'rate': pct(v[0], v[1])}
    for k, v in sorted(band.items())]

summary['by_piece'] = sorted(
    [{'piece': p,
      'moves': sum(1 for m in moves if m[11] == p),
      'errors': sum(1 for r in records if r['piece'] == p),
      'rate': pct(sum(1 for r in records if r['piece'] == p),
                  max(sum(1 for m in moves if m[11] == p), 1))}
     for p in 'KQRBNP'], key=lambda x: -x['rate'])

# recurring exact moves
rep = Counter((r['san'], r['move_no']) for r in records)
summary['recurring'] = [
    {'san': s, 'move_no': n, 'count': c}
    for (s, n), c in rep.most_common(12) if c >= 2]

json.dump({'summary': summary, 'records': records},
          open(os.path.join(OUT, 'analysis.json'), 'w'), indent=2)

print(f"\nerror rate {summary['error_rate']}%  "
      f"({by_cls.get('inaccuracy',0)} inacc / {by_cls.get('mistake',0)} mist / "
      f"{by_cls.get('blunder',0)} blun)")
for k, v in summary['themes'].items():
    print(f'  {k:18} {v["errors"]:3} errors, rate {v["error_rate"]}%, avg -{v["avg_cp"]}cp')
print(f'\nwrote {OUT}/analysis.json')
