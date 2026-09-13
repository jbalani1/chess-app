"""Recount material drops using the avoidable-loss measure.

The first pass asked "what is hanging after the move", which wrongly counted
moves played in positions where the material was already lost. This asks how
much the move gave away that some other legal move would have saved.
"""
import io
import os
import psycopg2
import chess
import chess.pgn
from collections import Counter
from dotenv import load_dotenv
from see import avoidable_drop
import scope

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
conn = psycopg2.connect(
    host=os.getenv('SUPABASE_HOST'), port=int(os.getenv('SUPABASE_PORT', 6543)),
    dbname=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'),
    password=os.getenv('SUPABASE_PASSWORD'), sslmode='require')
cur = conn.cursor()


def analyse(rows, replies, label, user_is_black):
    gross_2, marg_2, marg_1 = 0, [], 0
    already = 0
    for (gid, ply, san, uci, fen, best, before, phase) in rows:
        try:
            b = chess.Board(fen)
            mv = chess.Move.from_uci(uci)
        except Exception:
            continue
        marg, cap, gross, floor = avoidable_drop(b, mv)
        if gross >= 2:
            gross_2 += 1
        if gross >= 2 and marg < 2:
            already += 1
        if marg >= 2:
            marg_2.append(dict(gid=gid, ply=ply, san=san, cap=cap, marg=marg,
                               gross=gross, floor=floor, best=best,
                               before=before, phase=phase,
                               took=replies.get((gid, ply + 1)) == cap))
        elif marg == 1:
            marg_1 += 1

    punished = sum(1 for r in marg_2 if r['took'])
    print(f'\n=== {label} ===')
    print(f'  error moves examined:                       {len(rows)}')
    print(f'  OLD measure (>=2 pawns hanging after move): {gross_2}')
    print(f'    of those, material was already lost:      {already}')
    print(f'  NEW measure (>=2 pawns avoidably dropped):  {len(marg_2)}')
    print(f'  NEW measure (exactly 1 pawn):               {marg_1}')
    print(f'  punished: {punished}/{len(marg_2)} '
          f'({punished/max(len(marg_2),1)*100:.0f}%)')
    sizes = Counter(r['marg'] for r in marg_2)
    print('  sizes: ' + ', '.join(f'{k}p x{v}' for k, v in sorted(sizes.items(), reverse=True)))
    ph = Counter(r['phase'] for r in marg_2)
    print('  by phase: ' + ', '.join(f'{k} x{v}' for k, v in ph.most_common()))
    from_good = [r for r in marg_2 if (r['before'] or 0) > 100]
    print(f'  played from a better position (>+1.00): {len(from_good)} of {len(marg_2)}')
    return marg_2


# ------------------------------------------------------------------ Black 50
cur.execute("""
    WITH last50 AS (""" + scope.LAST_BLACK + """)
    SELECT l.id::text, m.ply, m.move_san, m.move_uci, m.position_fen_before,
           m.best_move_san, -m.eval_before, m.phase::text
    FROM last50 l JOIN moves m ON m.game_id=l.id
    WHERE m.classification IN ('mistake','blunder')
      AND m.ply %% 2 = 0 AND m.position_fen_before IS NOT NULL
    ORDER BY m.ply
""", scope.PARAMS)
black_rows = cur.fetchall()

cur.execute("WITH last50 AS (" + scope.LAST_BLACK + ") SELECT id::text, pgn FROM last50",
            scope.PARAMS)
replies = {}
for gid, pgn in cur.fetchall():
    g = chess.pgn.read_game(io.StringIO(pgn))
    node, i = g, 0
    while g and node.variations:
        node = node.variation(0)
        i += 1
        replies[(gid, i)] = node.san()

black = analyse(black_rows, replies, 'BLACK — last 50 games', True)

# ------------------------------------------------------------------ White Italian
ITAL = """
    g.username='negrilmannings' AND LOWER(g.white_player)='negrilmannings'
    AND (g.eco IN ('C50','C51','C52','C53','C54','C55','C56','C57','C58','C59')
         OR g.opening_name ILIKE '%%Italian%%' OR g.opening_name ILIKE '%%Giuoco%%'
         OR g.opening_name ILIKE '%%Two Knights%%' OR g.opening_name ILIKE '%%Evans%%'
         OR g.opening_name ILIKE '%%Hungarian%%')
    AND g.played_at < %(as_of)s
"""
cur.execute(f"""
    SELECT g.id::text, m.ply, m.move_san, m.move_uci, m.position_fen_before,
           m.best_move_san, m.eval_before, m.phase::text
    FROM games g JOIN moves m ON m.game_id=g.id
    WHERE {ITAL} AND m.classification IN ('mistake','blunder')
      AND m.ply %% 2 = 1 AND m.position_fen_before IS NOT NULL
""", {'as_of': scope.AS_OF})
white_rows = cur.fetchall()

cur.execute(f"SELECT DISTINCT g.id::text, g.pgn FROM games g WHERE {ITAL}",
            {'as_of': scope.AS_OF})
wreplies = {}
for gid, pgn in cur.fetchall():
    g = chess.pgn.read_game(io.StringIO(pgn))
    node, i = g, 0
    while g and node.variations:
        node = node.variation(0)
        i += 1
        wreplies[(gid, i)] = node.san()

white = analyse(white_rows, wreplies, 'WHITE — Italian games', False)
opening_drops = [r for r in white if (r['ply'] + 1) // 2 <= 15]
print(f'  inside moves 1-15: {len(opening_drops)}')

conn.close()
