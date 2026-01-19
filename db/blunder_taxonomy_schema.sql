-- Blunder Taxonomy Schema Extension
-- Adds detailed classification for mistakes and blunders

-- =============================================================================
-- ENUM TYPE
-- =============================================================================

CREATE TYPE blunder_category AS ENUM (
    'hanging_piece',       -- Left piece en prise (undefended or underdefended)
    'missed_tactic',       -- Failed to see opponent's tactical threat
    'overlooked_check',    -- Missed check, discovered check, or checkmate
    'greedy_capture',      -- Captured material but lost more (took the bait)
    'back_rank',           -- Back rank weakness exploited or missed
    'opening_principle',   -- Violated opening fundamentals (development, center, king safety)
    'endgame_technique',   -- Poor endgame knowledge (wrong technique, stalemate, etc.)
    'time_pressure',       -- Move made with < 60 seconds on clock
    'positional_collapse', -- Series of moves leading to lost position (unclear plan)
    'calculation_error'    -- Saw the idea but miscounted or missed a move
);

-- =============================================================================
-- ADD COLUMN TO MOVES TABLE
-- =============================================================================

ALTER TABLE moves
ADD COLUMN blunder_category blunder_category,
ADD COLUMN blunder_details JSONB;

-- blunder_details structure:
-- {
--   "hanging_piece": "Qd4",                    -- which piece was hanging
--   "missed_tactic_type": "fork",              -- fork, pin, skewer, discovery, etc.
--   "threat_before": "Nxf7 wins queen",        -- what opponent threatened
--   "better_move": "Kg1",                      -- what engine recommended
--   "better_move_eval": 150,                   -- eval after better move
--   "clock_remaining_seconds": 45,             -- if time_pressure
--   "explanation": "Queen left undefended..." -- human-readable explanation
-- }

CREATE INDEX idx_moves_blunder_category ON moves(blunder_category)
WHERE blunder_category IS NOT NULL;

-- =============================================================================
-- BLUNDER ANALYSIS TABLE (for aggregations and training)
-- =============================================================================

CREATE TABLE blunder_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL,
    category blunder_category NOT NULL,
    phase game_phase NOT NULL,
    piece_involved VARCHAR(10),           -- piece that was lost/misplayed

    -- Aggregated stats (updated periodically)
    occurrence_count INTEGER DEFAULT 0,
    total_eval_loss INTEGER DEFAULT 0,    -- sum of centipawn losses
    avg_eval_loss NUMERIC(10,2),

    -- Example games for review
    example_game_ids UUID[],              -- up to 5 representative examples
    example_fens TEXT[],                  -- positions where this happened

    -- Metadata
    first_seen TIMESTAMP WITH TIME ZONE,
    last_seen TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    UNIQUE(username, category, phase, piece_involved)
);

CREATE INDEX idx_blunder_patterns_username ON blunder_patterns(username);
CREATE INDEX idx_blunder_patterns_category ON blunder_patterns(category);

-- =============================================================================
-- VIEWS FOR ANALYSIS
-- =============================================================================

-- Blunder frequency by category
CREATE VIEW blunders_by_category AS
SELECT
    blunder_category,
    COUNT(*) as occurrences,
    ROUND(AVG(ABS(eval_delta)), 0) as avg_eval_loss,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage_of_blunders,
    array_agg(DISTINCT game_id ORDER BY game_id) FILTER (WHERE game_id IS NOT NULL) as game_ids
FROM moves
WHERE classification IN ('mistake', 'blunder')
  AND blunder_category IS NOT NULL
GROUP BY blunder_category
ORDER BY occurrences DESC;

-- Blunder category by phase (where do specific mistakes happen?)
CREATE VIEW blunders_by_category_and_phase AS
SELECT
    blunder_category,
    phase,
    COUNT(*) as occurrences,
    ROUND(AVG(ABS(eval_delta)), 0) as avg_eval_loss,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(PARTITION BY blunder_category), 1) as phase_percentage
FROM moves
WHERE classification IN ('mistake', 'blunder')
  AND blunder_category IS NOT NULL
GROUP BY blunder_category, phase
ORDER BY blunder_category,
    CASE phase WHEN 'opening' THEN 1 WHEN 'middlegame' THEN 2 WHEN 'endgame' THEN 3 END;

-- Blunder category by piece (which pieces are you mishandling?)
CREATE VIEW blunders_by_category_and_piece AS
SELECT
    blunder_category,
    piece_moved,
    COUNT(*) as occurrences,
    ROUND(AVG(ABS(eval_delta)), 0) as avg_eval_loss
FROM moves
WHERE classification IN ('mistake', 'blunder')
  AND blunder_category IS NOT NULL
GROUP BY blunder_category, piece_moved
ORDER BY blunder_category, occurrences DESC;

-- Worst blunder categories (prioritized for training)
CREATE VIEW blunder_priority_ranking AS
SELECT
    blunder_category,
    COUNT(*) as occurrences,
    ROUND(AVG(ABS(eval_delta)), 0) as avg_eval_loss,
    SUM(ABS(eval_delta)) as total_eval_loss,
    -- Priority score: frequency * severity
    ROUND(COUNT(*) * AVG(ABS(eval_delta)) / 100, 0) as priority_score
FROM moves
WHERE classification IN ('mistake', 'blunder')
  AND blunder_category IS NOT NULL
GROUP BY blunder_category
ORDER BY priority_score DESC;

-- Recent blunders for review
CREATE VIEW recent_blunders AS
SELECT
    m.id as move_id,
    m.game_id,
    g.played_at,
    g.opening_name,
    m.ply,
    m.move_san,
    m.classification,
    m.blunder_category,
    m.eval_before,
    m.eval_after,
    m.eval_delta,
    m.position_fen,
    m.blunder_details
FROM moves m
JOIN games g ON m.game_id = g.id
WHERE m.classification IN ('mistake', 'blunder')
  AND m.blunder_category IS NOT NULL
ORDER BY g.played_at DESC, m.ply
LIMIT 100;

-- =============================================================================
-- CLASSIFICATION HELPER FUNCTION
-- =============================================================================

-- This function provides classification hints based on available data
-- Full classification requires Python-side position analysis

CREATE OR REPLACE FUNCTION suggest_blunder_category(
    p_phase game_phase,
    p_eval_before INTEGER,
    p_eval_after INTEGER,
    p_piece_moved VARCHAR(10),
    p_move_san VARCHAR(20),
    p_tactical_motifs JSONB,
    p_positional_patterns JSONB
) RETURNS blunder_category AS $$
DECLARE
    v_eval_delta INTEGER;
    v_was_winning BOOLEAN;
    v_is_capture BOOLEAN;
BEGIN
    v_eval_delta := ABS(p_eval_after - p_eval_before);
    v_was_winning := p_eval_before > 100;
    v_is_capture := p_move_san ~ 'x';

    -- Check for back rank patterns
    IF p_tactical_motifs IS NOT NULL AND
       p_tactical_motifs::text ILIKE '%back_rank%' THEN
        RETURN 'back_rank';
    END IF;

    -- Check for missed tactics
    IF p_tactical_motifs IS NOT NULL AND
       jsonb_array_length(p_tactical_motifs) > 0 THEN
        RETURN 'missed_tactic';
    END IF;

    -- Opening principle violations (early game)
    IF p_phase = 'opening' AND p_piece_moved IN ('Q', 'K') THEN
        RETURN 'opening_principle';
    END IF;

    -- Endgame technique issues
    IF p_phase = 'endgame' THEN
        RETURN 'endgame_technique';
    END IF;

    -- Greedy capture that backfired
    IF v_is_capture AND v_eval_delta > 200 THEN
        RETURN 'greedy_capture';
    END IF;

    -- Large eval swing suggests calculation error
    IF v_eval_delta > 400 THEN
        RETURN 'calculation_error';
    END IF;

    -- Default: hanging piece (most common)
    RETURN 'hanging_piece';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- TRAINING RECOMMENDATIONS VIEW
-- =============================================================================

CREATE VIEW blunder_training_recommendations AS
SELECT
    blunder_category,
    occurrences,
    avg_eval_loss,
    priority_score,
    CASE blunder_category
        WHEN 'hanging_piece' THEN 'Practice "Checks, Captures, Threats" before every move'
        WHEN 'missed_tactic' THEN 'Daily tactics puzzles on Chess.com or Lichess'
        WHEN 'overlooked_check' THEN 'Practice checkmate patterns and king safety'
        WHEN 'greedy_capture' THEN 'Ask "Why is this free?" before capturing'
        WHEN 'back_rank' THEN 'Study back rank mate patterns; create luft early'
        WHEN 'opening_principle' THEN 'Review opening principles: development, center, castling'
        WHEN 'endgame_technique' THEN 'Study basic endgames: K+P, Lucena, Philidor'
        WHEN 'time_pressure' THEN 'Practice faster time controls; improve time management'
        WHEN 'positional_collapse' THEN 'Study strategic planning and prophylaxis'
        WHEN 'calculation_error' THEN 'Practice calculation: visualize 3-4 moves ahead'
    END as training_recommendation,
    CASE blunder_category
        WHEN 'hanging_piece' THEN 'https://lichess.org/practice/checkmates/piece-checkmates'
        WHEN 'missed_tactic' THEN 'https://lichess.org/training'
        WHEN 'overlooked_check' THEN 'https://lichess.org/practice/checkmates'
        WHEN 'back_rank' THEN 'https://lichess.org/practice/checkmates/back-rank-mate'
        WHEN 'endgame_technique' THEN 'https://lichess.org/practice/basic-endgames'
        ELSE NULL
    END as resource_link
FROM blunder_priority_ranking;
