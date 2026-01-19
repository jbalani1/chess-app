-- Add best move columns to moves table
-- These store what the user should have played instead (from Stockfish analysis)

ALTER TABLE moves ADD COLUMN IF NOT EXISTS best_move_san VARCHAR(20);
ALTER TABLE moves ADD COLUMN IF NOT EXISTS best_move_uci VARCHAR(10);

-- Add index for finding moves that have best_move populated
CREATE INDEX IF NOT EXISTS idx_moves_best_move ON moves(best_move_san) WHERE best_move_san IS NOT NULL;

COMMENT ON COLUMN moves.best_move_san IS 'Best move from Stockfish analysis (Standard Algebraic Notation)';
COMMENT ON COLUMN moves.best_move_uci IS 'Best move from Stockfish analysis (UCI notation)';
