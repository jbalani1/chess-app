"""
Lightweight ingester: fetch new games from Chess.com and analyze with Stockfish.
Only processes games not already in the database.
"""
import os
import io
import json
import sys
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
MOVE_TIME = float(os.getenv('STOCKFISH_MOVE_TIME', '0.4'))  # sec per engine call


def connect_db():
    return psycopg2.connect(
        host=os.getenv('SUPABASE_HOST'),
        port=int(os.getenv('SUPABASE_PORT', 6543)),
        dbname=os.getenv('SUPABASE_DB'),
        user=os.getenv('SUPABASE_USER'),
        password=os.getenv('SUPABASE_PASSWORD'),
        sslmode='require',
    )


def get_existing_game_ids(conn):
    cur = conn.cursor()
    cur.execute("SELECT chess_com_game_id FROM games WHERE username = %s", (USERNAME,))
    return {row[0] for row in cur.fetchall()}


def fetch_games_from_chesscom(year, month):
    url = f"https://api.chess.com/pub/player/{USERNAME}/games/{year}/{month:02d}"
    headers = {'User-Agent': 'ChessStudyApp/1.0'}
    resp = requests.get(url, headers=headers)
    resp.raise_for_status()
    return resp.json().get('games', [])


def parse_pgn_headers(pgn_str):
    headers = {}
    for line in pgn_str.split('\n'):
        if line.startswith('[') and line.endswith(']'):
            try:
                key, value = line[1:-1].split(' ', 1)
                headers[key] = value.strip('"')
            except ValueError:
                continue
    return headers


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
    """Simple blunder classification."""
    abs_delta = abs(eval_delta_cp)
    if abs_delta < 150:
        return None, None

    # Check if move gives or overlooks check
    board_copy = board_before.copy()
    board_copy.push(move)
    if best_move:
        board_test = board_before.copy()
        board_test.push(best_move)
        if board_test.is_check() and not board_copy.is_check():
            return 'overlooked_check', json.dumps({'explanation': 'Overlooked check sequence'})

    # Check for hanging piece
    if board_before.is_capture(move):
        captured = board_before.piece_at(move.to_square)
        if captured and abs_delta > 200:
            return 'greedy_capture', json.dumps({
                'explanation': f'Captured {captured.piece_type * 100}cp material but lost {abs_delta}cp'
            })
    else:
        # Check if a piece was left hanging
        piece = board_before.piece_at(move.from_square)
        if piece and abs_delta > 100:
            piece_names = {1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K'}
            pn = piece_names.get(piece.piece_type, '?')
            sq = chess.square_name(move.to_square)
            return 'hanging_piece', json.dumps({'explanation': f'{pn} on {sq} left undefended'})

    # Back rank
    if board_before.fullmove_number > 15:
        board_copy = board_before.copy()
        board_copy.push(move)
        if board_copy.is_checkmate():
            return 'back_rank', json.dumps({'explanation': 'Back rank weakness exploited'})

    # Calculation error (large swing)
    if abs_delta > 400:
        return 'calculation_error', json.dumps({
            'explanation': f'Large eval loss ({abs_delta}cp) suggests calculation error'
        })

    # Default
    if abs_delta >= 150:
        return 'positional_collapse', json.dumps({
            'explanation': 'Position deteriorated without clear tactical cause'
        })

    return None, None


def analyze_game(game_data, engine):
    """Analyze a single game with Stockfish. Returns (game_record, move_records) or None.
    Does NOT touch the database — all DB work happens in store_game after analysis."""
    pgn_str = game_data.get('pgn', '')
    if not pgn_str:
        return None

    headers = parse_pgn_headers(pgn_str)
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
        return None

    white_player = headers.get('White', 'Unknown')
    black_player = headers.get('Black', 'Unknown')
    is_user_white = white_player.lower() == USERNAME.lower()

    game_record = {
        'chess_com_id': chess_com_id,
        'pgn': pgn_str,
        'time_control': time_control,
        'eco': headers.get('ECO', ''),
        'opening_name': headers.get('Opening', 'Unknown'),
        'result': headers.get('Result', '*'),
        'white_player': white_player,
        'black_player': black_player,
        'played_at': played_at,
    }

    board = pgn_game.board()
    moves_list = list(pgn_game.mainline_moves())
    move_records = []

    for i, move in enumerate(moves_list):
        ply = i + 1
        is_user_move = (is_user_white and ply % 2 == 1) or (not is_user_white and ply % 2 == 0)

        fen_before = board.fen()

        info_before = engine.analyse(board, chess.engine.Limit(time=MOVE_TIME))
        score_before = info_before['score'].white()
        eval_before = score_before.score(mate_score=10000) if score_before else 0

        best_result = engine.play(board, chess.engine.Limit(time=MOVE_TIME))
        best_move = best_result.move

        piece_moved_obj = board.piece_at(move.from_square)
        piece_moved = {1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K'}.get(
            piece_moved_obj.piece_type, 'P') if piece_moved_obj else 'P'

        captured_obj = board.piece_at(move.to_square)
        captured_piece = {1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K'}.get(
            captured_obj.piece_type, None) if captured_obj else None

        move_san = board.san(move)
        best_move_san = board.san(best_move) if best_move else None

        board_before_copy = board.copy()
        board.push(move)

        info_after = engine.analyse(board, chess.engine.Limit(time=MOVE_TIME))
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

        move_records.append({
            'ply': ply,
            'move_san': move_san,
            'move_uci': move.uci(),
            'eval_before': eval_before,
            'eval_after': eval_after,
            'eval_delta': eval_delta,
            'classification': classification,
            'piece_moved': piece_moved,
            'phase': phase,
            'position_fen': board.fen(),
            'position_fen_before': fen_before,
            'best_move_san': best_move_san,
            'best_move_uci': best_move.uci() if best_move else None,
            'captured_piece': captured_piece,
            'blunder_category': blunder_cat,
            'blunder_details': blunder_det,
        })

    return game_record, move_records


def store_analyzed_game(conn_factory, game_record, move_records):
    """Insert the game + all its moves in a single short transaction.
    conn_factory is a callable returning a fresh psycopg2 connection so we
    don't reuse a connection that may have been killed by the pooler."""
    conn = conn_factory()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO games (username, chess_com_game_id, pgn, time_control, eco, opening_name,
                              result, white_player, black_player, played_at, analyzed_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (chess_com_game_id) DO NOTHING
            RETURNING id
        """, (
            USERNAME, game_record['chess_com_id'], game_record['pgn'], game_record['time_control'],
            game_record['eco'], game_record['opening_name'], game_record['result'],
            game_record['white_player'], game_record['black_player'], game_record['played_at'],
        ))
        row = cur.fetchone()
        if not row:
            conn.commit()
            return False
        game_id = row[0]

        move_rows = [
            (
                game_id, m['ply'], m['move_san'], m['move_uci'], m['eval_before'], m['eval_after'],
                m['eval_delta'], m['classification'], m['piece_moved'], m['phase'], m['position_fen'],
                m['position_fen_before'], m['best_move_san'], m['best_move_uci'], m['captured_piece'],
                m['blunder_category'], m['blunder_details'],
            )
            for m in move_records
        ]
        cur.executemany("""
            INSERT INTO moves (game_id, ply, move_san, move_uci, eval_before, eval_after,
                             eval_delta, classification, piece_moved, phase, position_fen,
                             position_fen_before, best_move_san, best_move_uci, captured_piece,
                             blunder_category, blunder_details)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, move_rows)
        conn.commit()
        return True
    finally:
        conn.close()


def analyze_and_store(conn_factory, game_data, engine):
    """Analyze a game with Stockfish (no DB), then persist it in a short transaction."""
    result = analyze_game(game_data, engine)
    if result is None:
        return
    game_record, move_records = result
    stored = store_analyzed_game(conn_factory, game_record, move_records)
    if stored:
        print(
            f"  Stored game {game_record['chess_com_id']}: {len(move_records)} moves, "
            f"played {game_record['played_at'].date()}",
            flush=True,
        )


NUM_WORKERS = 2


def run_aggregation():
    """Refresh the precomputed blunder_patterns table after ingestion so the
    dashboard hero and Insights → Recurring reflect the newly ingested games.
    The raw games/moves already feed the live views; this rebuilds the
    aggregate table that those two surfaces read from.

    Isolated in its own try/except: a failure here must not undo a successful
    ingest (the games are already stored)."""
    try:
        from aggregate_patterns import PatternAggregator
        print("\nRefreshing blunder_patterns aggregation...", flush=True)
        aggregator = PatternAggregator()
        try:
            aggregator.aggregate(USERNAME)
        finally:
            aggregator.close()
    except Exception as e:
        print(f"Aggregation step failed (ingest itself was fine): {e}", flush=True)


def worker_fn(worker_id, game_batch, existing_ids):
    """Each worker gets its own Stockfish engine and opens a fresh DB
    connection only at persist time — keeping the pooler from killing us
    during long analysis runs."""
    engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    engine.configure({'Threads': 2, 'Hash': 256})

    done = 0
    errors = 0
    try:
        for game_data in game_batch:
            url = game_data.get('url', '')
            gid = url.split('/')[-1] if url else str(game_data.get('end_time', 0))
            if gid in existing_ids:
                continue
            try:
                import time as _time
                t0 = _time.time()
                print(f"  [W{worker_id}] Analyzing {gid}...", flush=True)
                analyze_and_store(connect_db, game_data, engine)
                print(f"  [W{worker_id}] {gid} done in {_time.time()-t0:.1f}s", flush=True)
                done += 1
            except Exception as e:
                print(f"  [W{worker_id}] Error: {e}", flush=True)
                errors += 1
                continue
    finally:
        engine.quit()

    print(f"  [W{worker_id}] Finished: {done} games, {errors} errors", flush=True)


def main():
    from concurrent.futures import ThreadPoolExecutor, as_completed
    import threading

    print("Connecting to database...", flush=True)
    conn = connect_db()
    print("Connected.", flush=True)
    existing_ids = get_existing_game_ids(conn)
    print(f"Found {len(existing_ids)} existing games in DB", flush=True)
    conn.close()

    # Fetch current month's games
    now = datetime.now()
    year, month = now.year, now.month
    print(f"Fetching {year}-{month:02d} games from Chess.com...", flush=True)
    games = fetch_games_from_chesscom(year, month)
    print(f"Found {len(games)} total games in {year}-{month:02d}", flush=True)

    # Also grab last month in case there are stragglers
    prev_month = month - 1 if month > 1 else 12
    prev_year = year if month > 1 else year - 1
    print(f"Fetching {prev_year}-{prev_month:02d} games from Chess.com...", flush=True)
    try:
        prev_games = fetch_games_from_chesscom(prev_year, prev_month)
        print(f"Found {len(prev_games)} total games in {prev_year}-{prev_month:02d}", flush=True)
        games.extend(prev_games)
    except Exception as e:
        print(f"Could not fetch previous month: {e}", flush=True)

    # Filter to new games only
    new_games = []
    for g in games:
        url = g.get('url', '')
        gid = url.split('/')[-1] if url else str(g.get('end_time', 0))
        if gid not in existing_ids:
            new_games.append(g)

    print(f"{len(new_games)} new games to ingest", flush=True)

    if not new_games:
        print("No new games to ingest.", flush=True)
        return

    # Split games across workers
    batches = [[] for _ in range(NUM_WORKERS)]
    for i, g in enumerate(new_games):
        batches[i % NUM_WORKERS].append(g)

    print(f"Starting {NUM_WORKERS} parallel workers ({len(new_games)} games)...", flush=True)

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
        futures = []
        for wid, batch in enumerate(batches):
            if batch:
                futures.append(executor.submit(worker_fn, wid, batch, existing_ids))

        for f in as_completed(futures):
            try:
                f.result()
            except Exception as e:
                print(f"Worker failed: {e}", flush=True)

    # New games were stored — rebuild the aggregated pattern table so every
    # surface (not just the live views) reflects them.
    run_aggregation()

    print("Done!", flush=True)


if __name__ == '__main__':
    main()
