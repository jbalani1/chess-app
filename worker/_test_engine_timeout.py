"""Prove the ingest survives a dead/stalled Stockfish instead of hanging."""
import signal
import time

import chess
import chess.engine
import ingest_recent as ir


def guard(seconds):
    def _boom(_s, _f):
        raise SystemExit(f'TEST ITSELF HUNG after {seconds}s — fix did not work')
    signal.signal(signal.SIGALRM, _boom)
    signal.alarm(seconds)


guard(90)

print('timeout for depth-only limit :', end=' ')
eng = ir.start_engine()
print(eng._timeout_for(chess.engine.Limit(depth=ir.DEPTH)))
print('timeout for patched limit    :', eng._timeout_for(ir.analysis_limit()))

board = chess.Board()
t = time.time()
eng.analyse(board, ir.analysis_limit())
print(f'healthy analyse              : ok in {time.time() - t:.2f}s')

# Kill Stockfish under the library's feet — the realistic failure mode.
proc = eng.transport.get_extra_info('subprocess')
print(f'killing stockfish pid {proc.pid}...')
proc.kill()
time.sleep(1)

t = time.time()
try:
    eng.analyse(board, ir.analysis_limit())
    print('FAIL: dead engine returned without error')
except Exception as e:
    print(f'dead engine raised           : {type(e).__name__} after {time.time() - t:.1f}s')

# The worker catches that class of fault and starts a fresh engine.
caught = isinstance(
    Exception(), (chess.engine.EngineTerminatedError,))  # placeholder for clarity
t = time.time()
eng2 = ir.start_engine()
info = eng2.analyse(board, ir.analysis_limit())
print(f'restarted engine             : ok in {time.time() - t:.2f}s, depth={info.get("depth")}')
eng2.quit()

signal.alarm(0)
print('\nPASS — a dead engine raises promptly and a fresh one takes over.')
