"""Bench N parallel engines. Usage: python bench_parallel.py [N_WORKERS] [THREADS_EACH]"""
import sys
import time
import chess
import chess.engine
from concurrent.futures import ThreadPoolExecutor, as_completed

STOCKFISH_PATH = '/opt/homebrew/bin/stockfish'
N_WORKERS = int(sys.argv[1]) if len(sys.argv) > 1 else 4
THREADS_EACH = int(sys.argv[2]) if len(sys.argv) > 2 else 2
TIME_LIMIT = 0.4
N_PLIES = 10

def worker(wid):
    engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)
    engine.configure({'Threads': THREADS_EACH, 'Hash': 256})
    board = chess.Board()
    t0 = time.time()
    calls = 0
    for i in range(N_PLIES):
        engine.analyse(board, chess.engine.Limit(time=TIME_LIMIT))
        best = engine.play(board, chess.engine.Limit(time=TIME_LIMIT))
        board.push(best.move)
        engine.analyse(board, chess.engine.Limit(time=TIME_LIMIT))
        calls += 3
        if board.is_game_over():
            break
    total = time.time() - t0
    engine.quit()
    return wid, total, calls

print(f"Config: {N_WORKERS} workers, {THREADS_EACH} threads each, time={TIME_LIMIT}s, {N_PLIES} plies")
expected = N_PLIES * 3 * TIME_LIMIT
print(f"Expected per-worker wall (no contention): {expected:.1f}s")

t0 = time.time()
with ThreadPoolExecutor(max_workers=N_WORKERS) as ex:
    futs = [ex.submit(worker, i) for i in range(N_WORKERS)]
    for f in as_completed(futs):
        wid, total, calls = f.result()
        print(f"  W{wid}: {total:.1f}s wall ({calls} calls, {total/calls:.3f}s/call)")
print(f"Total wall: {time.time()-t0:.1f}s")
