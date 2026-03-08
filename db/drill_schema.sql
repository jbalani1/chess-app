-- Drill Mode Schema
-- Tracks user's practice attempts on positions where they previously blundered

-- Table to track each drill attempt
CREATE TABLE IF NOT EXISTS drill_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  move_id UUID NOT NULL REFERENCES moves(id) ON DELETE CASCADE,
  username VARCHAR(255) NOT NULL,

  -- What the user played
  attempted_move_uci VARCHAR(10),
  attempted_move_san VARCHAR(15),
  is_correct BOOLEAN NOT NULL,
  time_spent_ms INTEGER,

  -- Spaced repetition fields (simplified SM-2 algorithm)
  easiness_factor DECIMAL(3,2) DEFAULT 2.5,
  repetition_number INTEGER DEFAULT 0,
  interval_days INTEGER DEFAULT 1,
  next_review_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_drill_attempts_move_id ON drill_attempts(move_id);
CREATE INDEX IF NOT EXISTS idx_drill_attempts_username ON drill_attempts(username);
CREATE INDEX IF NOT EXISTS idx_drill_attempts_next_review ON drill_attempts(username, next_review_at);
CREATE INDEX IF NOT EXISTS idx_drill_attempts_created ON drill_attempts(created_at DESC);

-- View to get the latest attempt for each move (for spaced repetition)
CREATE OR REPLACE VIEW drill_latest_attempts AS
SELECT DISTINCT ON (move_id, username)
  id,
  move_id,
  username,
  attempted_move_uci,
  attempted_move_san,
  is_correct,
  time_spent_ms,
  easiness_factor,
  repetition_number,
  interval_days,
  next_review_at,
  created_at
FROM drill_attempts
ORDER BY move_id, username, created_at DESC;

-- View to get drill statistics by category
CREATE OR REPLACE VIEW drill_stats_by_category AS
SELECT
  da.username,
  m.blunder_category,
  COUNT(DISTINCT da.move_id) as positions_drilled,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE da.is_correct) as correct_attempts,
  ROUND(100.0 * COUNT(*) FILTER (WHERE da.is_correct) / NULLIF(COUNT(*), 0), 1) as accuracy_pct,
  COUNT(DISTINCT da.move_id) FILTER (WHERE dla.repetition_number >= 3 AND dla.interval_days >= 7) as mastered
FROM drill_attempts da
JOIN moves m ON da.move_id = m.id
LEFT JOIN drill_latest_attempts dla ON da.move_id = dla.move_id AND da.username = dla.username
WHERE m.blunder_category IS NOT NULL
GROUP BY da.username, m.blunder_category;

-- View to get positions due for review
CREATE OR REPLACE VIEW drill_positions_due AS
SELECT
  m.id as move_id,
  m.game_id,
  m.position_fen,
  m.best_move_san,
  m.best_move_uci,
  m.blunder_category,
  m.blunder_details,
  m.eval_delta,
  m.phase,
  m.ply,
  g.white_player,
  g.black_player,
  g.username,
  g.played_at,
  dla.next_review_at,
  dla.repetition_number,
  dla.easiness_factor,
  dla.is_correct as last_attempt_correct
FROM moves m
JOIN games g ON m.game_id = g.id
LEFT JOIN drill_latest_attempts dla ON m.id = dla.move_id AND g.username = dla.username
WHERE m.classification IN ('mistake', 'blunder')
  AND m.blunder_category IS NOT NULL
  AND m.best_move_uci IS NOT NULL;
