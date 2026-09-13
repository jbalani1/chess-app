"""Benchmark Stockfish speed with the same settings ingest_recent.py uses."""
import time
import chess
import chess.engine

STOCKFISH_PATH = '/opt/homebrew/bin/stockfish'

def bench(time_limit=0.4, threads=2, n_moves=20):
    engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    engine.configure({'Threads': threads, 'Hash': 256})

    board = chess.Board()
    total_start = time.time()
    call_times = []
    for i in range(n_moves):
        # Mirror ingest: analyse + play + analyse after push
        t0 = time.time()
        info = engine.analyse(board, chess.engine.Limit(time=time_limit))
        t1 = time.time()
        best = engine.play(board, chess.engine.Limit(time=time_limit))
        t2 = time.time()
        board.push(best.move)
        info2 = engine.analyse(board, chess.engine.Limit(time=time_limit))
        t3 = time.time()
        call_times.append((t1 - t0, t2 - t1, t3 - t2))
        print(f"ply {i+1}: analyse={t1-t0:.3f}s play={t2-t1:.3f}s analyse2={t3-t2:.3f}s", flush=True)
        if board.is_game_over():
            break

    total = time.time() - total_start
    avg_call = sum(sum(c) for c in call_times) / (3 * len(call_times))
    print(f"\nTotal wall: {total:.1f}s for {len(call_times)} plies (3 calls each)")
    print(f"Avg per engine call: {avg_call:.3f}s")
    print(f"Projected for 60-move game: {60 * 3 * avg_call:.1f}s")
    engine.quit()

if __name__ == '__main__':
    bench()
