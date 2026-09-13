"""Locate the exact positions worth drawing, with FEN + the move played + the
engine's move, so each diagram can be rendered from real game data."""
import os
import io
import psycopg2
import chess
import chess.pgn
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
USER = 'negrilmannings'
conn = psycopg2.connect(
    host=os.getenv('SUPABASE_HOST'), port=int(os.getenv('SUPABASE_PORT', 6543)),
    dbname=os.getenv('SUPABASE_DB'), user=os.getenv('SUPABASE_USER'),
    password=os.getenv('SUPABASE_PASSWORD'), sslmode='require')
cur = conn.cursor()


def show(title, rows):
    print("\n" + "=" * 78)
    print(title)
    print("=" * 78)
    for r in rows:
        gid, ply, san, uci, fen, best_san, best_uci, eb, ea, res, opening = r
        print(f"  game={gid}  ply={ply} (move {(ply+1)//2})  {san} [{uci}]")
        print(f"     eval {(-eb if ply%2==0 else eb)/100:+.2f} -> {(-ea if ply%2==0 else ea)/100:+.2f}"
              f"   engine: {best_san} [{best_uci}]   result={res}")
        print(f"     fen: {fen}")
        print(f"     opening: {(opening or '')[:60]}")


COLS = """g.id, m.ply, m.move_san, m.move_uci, m.position_fen_before,
          m.best_move_san, m.best_move_uci, m.eval_before, m.eval_after,
          g.result, g.opening_name"""

BLACK50 = """
    g.id IN (SELECT id FROM games WHERE username=%(u)s AND LOWER(black_player)=%(u)s
             ORDER BY played_at DESC LIMIT 50)
"""
P = {'u': USER}

# --- Black: hanging a rook while winning -----------------------------------
cur.execute(f"""
    SELECT {COLS} FROM games g JOIN moves m ON m.game_id=g.id
    WHERE {BLACK50} AND m.ply %% 2 = 0
      AND m.classification='blunder'
      AND -m.eval_before > 300
      AND m.position_fen_before IS NOT NULL
      AND m.move_san IN ('Rg8','Rxd4','Rxa2','Rd8','Rxe4')
    ORDER BY -m.eval_before DESC LIMIT 6
""", P)
show("BLACK — rook moves played from a winning position", cur.fetchall())

# --- Black: losing the queen -----------------------------------------------
cur.execute(f"""
    SELECT {COLS} FROM games g JOIN moves m ON m.game_id=g.id
    WHERE {BLACK50} AND m.ply %% 2 = 0
      AND m.classification IN ('mistake','blunder')
      AND m.move_san = 'Qxf3'
      AND m.position_fen_before IS NOT NULL
    LIMIT 3
""", P)
show("BLACK — the Qxf3 queen loss", cur.fetchall())

# --- Black: opening exd4 mistake -------------------------------------------
cur.execute(f"""
    SELECT {COLS} FROM games g JOIN moves m ON m.game_id=g.id
    WHERE {BLACK50} AND m.ply %% 2 = 0
      AND m.classification IN ('mistake','blunder')
      AND m.move_san='exd4' AND (m.ply+1)/2 <= 16
      AND m.position_fen_before IS NOT NULL
    ORDER BY ABS(m.eval_delta) DESC LIMIT 4
""", P)
show("BLACK — exd4 in the opening", cur.fetchall())

# --- Black: endgame king move ----------------------------------------------
cur.execute(f"""
    SELECT {COLS} FROM games g JOIN moves m ON m.game_id=g.id
    WHERE {BLACK50} AND m.ply %% 2 = 0
      AND m.classification='blunder' AND m.phase='endgame'
      AND m.piece_moved IN ('K','N')
      AND m.position_fen_before IS NOT NULL
      AND -m.eval_before > -200
    ORDER BY ABS(m.eval_delta) DESC LIMIT 6
""", P)
show("BLACK — endgame king / knight blunders from a playable position", cur.fetchall())

# --- White Italian: the Bb4+ position --------------------------------------
ITAL = """
    g.username=%(u)s AND LOWER(g.white_player)=%(u)s
    AND (g.eco LIKE 'C5%%' OR g.opening_name ILIKE '%%Italian%%'
         OR g.opening_name ILIKE '%%Giuoco%%' OR g.opening_name ILIKE '%%Two Knights%%')
"""
cur.execute(f"""
    SELECT {COLS} FROM games g JOIN moves m ON m.game_id=g.id
    WHERE {ITAL} AND m.ply %% 2 = 1
      AND m.move_san LIKE 'Bxf7%%'
      AND m.classification='blunder'
      AND m.position_fen_before IS NOT NULL
      AND m.eval_before > 150
    ORDER BY m.eval_before DESC LIMIT 8
""", P)
show("WHITE — unsound Bxf7+ from a clearly better position", cur.fetchall())

# --- White Italian: move-9 Re1 ---------------------------------------------
cur.execute(f"""
    SELECT {COLS} FROM games g JOIN moves m ON m.game_id=g.id
    WHERE {ITAL} AND m.ply %% 2 = 1
      AND m.move_san='Re1' AND (m.ply+1)/2 BETWEEN 8 AND 11
      AND m.classification IN ('mistake','blunder')
      AND m.position_fen_before IS NOT NULL
    ORDER BY ABS(m.eval_delta) DESC LIMIT 5
""", P)
show("WHITE — Re1 around move 9", cur.fetchall())

# --- White Italian: the a1 rook drop ---------------------------------------
cur.execute(f"""
    SELECT {COLS} FROM games g JOIN moves m ON m.game_id=g.id
    WHERE {ITAL} AND m.ply %% 2 = 1
      AND m.move_san IN ('Kf1','Ne4') AND (m.ply+1)/2 BETWEEN 9 AND 14
      AND m.classification IN ('mistake','blunder')
      AND m.position_fen_before IS NOT NULL
    ORDER BY (m.ply+1)/2 LIMIT 8
""", P)
show("WHITE — candidates for the ...Nxa1 rook drop", cur.fetchall())

conn.close()
