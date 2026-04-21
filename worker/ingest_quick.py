"""
Quick ingester: fetch new games from Chess.com and analyze with Stockfish at lower depth.
"""
import os
import io
import json
import requests
import chess
import chess.pgn
import chess.engine
import psycopg2
from datetime import datetime
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

USERNAME = 'negrilmannings'
STOCKFISH_PATH = '/opt/homebrew/bin/stockfish'
DEPTH = 14  # Lower depth for speed


def connect_db():
    return psycopg2.connect(
        host=os.getenv('SUPABASE_HOST'),
        port=int(os.getenv('SUPABASE_PORT', 6543)),
        dbname=os.getenv('SUPABASE_DB'),
        user=os.getenv('SUPABASE_USER'),
        password=os.getenv('SUPABASE_PASSWORD'),
        sslmode='require',
    )


def get_phase(ply):
    if ply <= 30:
        return 'opening'
    elif ply <= 80:
        return 'middlegame'
    return 'endgame'


def classify_move(eval_delta_cp):
    abs_delta = abs(eval_delta_cp)
    if abs_delta < 50:
        return 'good'
    elif abs_delta < 150:
        return 'inaccuracy'
    elif abs_delta < 300:
        return 'mistake'
    return 'blunder'


def classify_blunder(eval_delta_cp, board_before, move, best_move, eval_before, eval_after):
    abs_delta = abs(eval_delta_cp)
    if abs_delta < 150:
        return None, None

    if best_move:
        board_test = board_before.copy()
        board_test.push(best_move)
        board_copy = board_before.copy()
        board_copy.push(move)
        if board_test.is_check() and not board_copy.is_check():
            return 'overlooked_check', json.dumps({'explanation': 'Overlooked check sequence'})

    if board_before.is_capture(move):
        captured = board_before.piece_at(move.to_square)
        if captured and abs_delta > 200:
            cap_val = {1: 100, 2: 320, 3: 330, 4: 500, 5: 900, 6: 0}.get(captured.piece_type, 100)
            return 'greedy_capture', json.dumps({
                'explanation': f'Captured {cap_val}cp material but lost {abs_delta}cp'
            })

    piece = board_before.piece_at(move.from_square)
    if piece and abs_delta > 100:
        pn = {1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K'}.get(piece.piece_type, '?')
        sq = chess.square_name(move.to_square)
        return 'hanging_piece', json.dumps({'explanation': f'{pn} on {sq} left undefended'})

    if abs_delta > 400:
        return 'calculation_error', json.dumps({
            'explanation': f'Large eval loss ({abs_delta}cp) suggests calculation error'
        })

    if abs_delta >= 150:
        return 'positional_collapse', json.dumps({
            'explanation': 'Position deteriorated without clear tactical cause'
        })

    return None, None


def analyze_game(conn, game_data, engine):
    pgn_str = game_data.get('pgn', '')
    if not pgn_str:
        return

    headers = {}
    for line in pgn_str.split('\n'):
        if line.startswith('[') and line.endswith(']'):
            try:
                key, value = line[1:-1].split(' ', 1)
                headers[key] = value.strip('"')
            except ValueError:
                continue

    game_url = game_data.get('url', '')
    chess_com_id = game_url.split('/')[-1] if game_url else str(game_data.get('end_time', 0))

    time_control = game_data.get('time_control', '0+0')
    if '+' in time_control:
        parts = time_control.split('+')
        base = int(parts[0]) if parts[0] not in ('-', '') else 0
        inc = int(parts[1]) if len(parts) > 1 and parts[1] else 0
        time_control = f"{base // 60}+{inc}"

    played_at = datetime.fromtimestamp(game_data.get('end_time', 0))

    pgn_game = chess.pgn.read_game(io.StringIO(pgn_str))
    if not pgn_game:
        return

    white_player = headers.get('White', 'Unknown')
    black_player = headers.get('Black', 'Unknown')
    is_user_white = white_player.lower() == USERNAME.lower()

    cur = conn.cursor()
    cur.execute(
        "INSERT INTO games (username, chess_com_game_id, pgn, time_control, eco, opening_name, "
        "result, white_player, black_player, played_at, analyzed_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW()) "
        "ON CONFLICT (chess_com_game_id) DO NOTHING RETURNING id",
        (USERNAME, chess_com_id, pgn_str, time_control,
         headers.get('ECO', ''), headers.get('Opening', 'Unknown'),
         headers.get('Result', '*'), white_player, black_player, played_at)
    )
    result = cur.fetchone()
    if not result:
        return
    game_id = result[0]

    board = pgn_game.board()
    moves_list = list(pgn_game.mainline_moves())

    for i, move in enumerate(moves_list):
        ply = i + 1
        is_user_move = (is_user_white and ply % 2 == 1) or (not is_user_white and ply % 2 == 0)

        fen_before = board.fen()

        info_before = engine.analyse(board, chess.engine.Limit(depth=DEPTH))
        score_before = info_before['score'].white()
        eval_before = score_before.score(mate_score=10000) if score_before else 0

        best_result = engine.play(board, chess.engine.Limit(depth=DEPTH))
        best_move = best_result.move

        piece_obj = board.piece_at(move.from_square)
        piece_moved = {1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K'}.get(
            piece_obj.piece_type, 'P') if piece_obj else 'P'

        captured_obj = board.piece_at(move.to_square)
        captured_piece = {1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K'}.get(
            captured_obj.piece_type, None) if captured_obj else None

        move_san = board.san(move)
        best_move_san = board.san(best_move) if best_move else None

        board_before_copy = board.copy()
        board.push(move)

        info_after = engine.analyse(board, chess.engine.Limit(depth=DEPTH))
        score_after = info_after['score'].white()
        eval_after = score_after.score(mate_score=10000) if score_after else 0

        eval_delta = eval_after - eval_before
        if ply % 2 == 0:
            eval_delta = -eval_delta

        classification = classify_move(eval_delta)
        phase = get_phase(ply)

        blunder_cat = None
        blunder_det = None
        if is_user_move and classification in ('mistake', 'blunder'):
            blunder_cat, blunder_det = classify_blunder(
                eval_delta, board_before_copy, move, best_move, eval_before, eval_after
            )

        cur.execute(
            "INSERT INTO moves (game_id, ply, move_san, move_uci, eval_before, eval_after, "
            "eval_delta, classification, piece_moved, phase, position_fen, "
            "position_fen_before, best_move_san, best_move_uci, captured_piece, "
            "blunder_category, blunder_details) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
            (game_id, ply, move_san, move.uci(), eval_before, eval_after,
             eval_delta, classification, piece_moved, phase, board.fen(),
             fen_before, best_move_san, best_move.uci() if best_move else None,
             captured_piece, blunder_cat, blunder_det)
        )

    conn.commit()
    print(f"  Stored: {len(moves_list)} moves, {played_at.date()}")


def main():
    conn = connect_db()

    cur = conn.cursor()
    cur.execute("SELECT chess_com_game_id FROM games WHERE username = %s", (USERNAME,))
    existing = {row[0] for row in cur.fetchall()}
    print(f"Existing: {len(existing)} games")

    resp = requests.get(
        f"https://api.chess.com/pub/player/{USERNAME}/games/2026/03",
        headers={'User-Agent': 'ChessStudyApp/1.0'}
    )
    resp.raise_for_status()
    all_games = resp.json().get('games', [])

    new_games = []
    for g in all_games:
        url = g.get('url', '')
        gid = url.split('/')[-1] if url else str(g.get('end_time', 0))
        if gid not in existing:
            new_games.append(g)

    print(f"New games to ingest: {len(new_games)}")
    if not new_games:
        conn.close()
        return

    print("Starting Stockfish (depth 14)...")
    engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    engine.configure({'Threads': 4, 'Hash': 512})

    try:
        for i, gd in enumerate(new_games):
            print(f"[{i+1}/{len(new_games)}]", end=" ")
            try:
                analyze_game(conn, gd, engine)
            except Exception as e:
                print(f"  Error: {e}")
                conn.rollback()
    finally:
        engine.quit()
        conn.close()

    print("Done!")


if __name__ == '__main__':
    main()
