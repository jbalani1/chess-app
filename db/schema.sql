-- Chess Analysis App Database Schema
-- Supabase/PostgreSQL schema for storing chess games, moves, and analysis

-- Create enums
CREATE TYPE move_classification AS ENUM ('good', 'inaccuracy', 'mistake', 'blunder');
CREATE TYPE game_phase AS ENUM ('opening', 'middlegame', 'endgame');

-- Engine configurations table
CREATE TABLE engine_configs (
    config_hash VARCHAR(64) PRIMARY KEY,
    skill_level INTEGER NOT NULL,
    threads INTEGER NOT NULL,
    hash_mb INTEGER NOT NULL,
    multi_pv INTEGER NOT NULL,
    move_time_ms INTEGER NOT NULL,
    stockfish_version VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raw downloaded games (pre-analysis)
CREATE TABLE raw_games (
    chess_com_game_id VARCHAR(100) PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    pgn TEXT NOT NULL,
    time_control VARCHAR(20),
    eco VARCHAR(10),
    opening_name VARCHAR(200),
    result VARCHAR(10),
    white_player VARCHAR(100),
    black_player VARCHAR(100),
    played_at TIMESTAMP WITH TIME ZONE,
    downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    analyzed_at TIMESTAMP WITH TIME ZONE
);

-- Games table
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) NOT NULL,
    chess_com_game_id VARCHAR(100) UNIQUE NOT NULL,
    pgn TEXT NOT NULL,
    time_control VARCHAR(20),
    eco VARCHAR(10),
    opening_name VARCHAR(200),
    result VARCHAR(10) NOT NULL, -- '1-0', '0-1', '1/2-1/2'
    white_player VARCHAR(100) NOT NULL,
    black_player VARCHAR(100) NOT NULL,
    played_at TIMESTAMP WITH TIME ZONE NOT NULL,
    analyzed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    engine_config_hash VARCHAR(64) REFERENCES engine_configs(config_hash),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Moves table
CREATE TABLE moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    ply INTEGER NOT NULL, -- 1-based ply number
    move_san VARCHAR(20) NOT NULL, -- Standard Algebraic Notation
    move_uci VARCHAR(10) NOT NULL, -- Universal Chess Interface
    eval_before INTEGER, -- centipawns
    eval_after INTEGER, -- centipawns
    eval_delta INTEGER, -- eval_after - eval_before (flipped for Black)
    classification move_classification,
    piece_moved VARCHAR(10) NOT NULL, -- 'P', 'N', 'B', 'R', 'Q', 'K'
    phase game_phase NOT NULL,
    position_fen VARCHAR(100) NOT NULL,
    tactical_motifs JSONB, -- Array of tactical motifs found
    positional_patterns JSONB, -- Array of positional patterns
    recommendations TEXT[], -- Array of recommendations
    move_quality VARCHAR(20), -- 'excellent', 'good', 'questionable', 'poor'
    engine_config_hash VARCHAR(64) REFERENCES engine_configs(config_hash),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(game_id, ply, engine_config_hash)
);

-- Indexes for performance
CREATE INDEX idx_games_username ON games(username);
CREATE INDEX idx_games_played_at ON games(played_at);
CREATE INDEX idx_games_eco ON games(eco);
CREATE INDEX idx_games_time_control ON games(time_control);
CREATE INDEX idx_games_analyzed_at ON games(analyzed_at);
CREATE INDEX idx_raw_games_user_played ON raw_games(username, played_at);
CREATE INDEX idx_raw_games_analyzed ON raw_games(analyzed_at);

CREATE INDEX idx_moves_game_id ON moves(game_id);
CREATE INDEX idx_moves_classification ON moves(classification);
CREATE INDEX idx_moves_piece_moved ON moves(piece_moved);
CREATE INDEX idx_moves_phase ON moves(phase);
CREATE INDEX idx_moves_eval_delta ON moves(eval_delta);
CREATE INDEX idx_moves_ply ON moves(ply);

-- Views for aggregations
CREATE VIEW mistakes_by_piece AS
SELECT 
    piece_moved,
    COUNT(*) as total_moves,
    COUNT(*) FILTER (WHERE classification = 'good') as good_moves,
    COUNT(*) FILTER (WHERE classification = 'inaccuracy') as inaccuracies,
    COUNT(*) FILTER (WHERE classification = 'mistake') as mistakes,
    COUNT(*) FILTER (WHERE classification = 'blunder') as blunders,
    ROUND(AVG(eval_delta), 2) as avg_eval_delta,
    ROUND(COUNT(*) FILTER (WHERE classification IN ('mistake', 'blunder')) * 100.0 / COUNT(*), 2) as mistake_rate
FROM moves
GROUP BY piece_moved
ORDER BY mistake_rate DESC;

CREATE VIEW mistakes_by_opening AS
SELECT 
    g.eco,
    g.opening_name,
    COUNT(DISTINCT g.id) as games_played,
    COUNT(m.id) as total_moves,
    COUNT(m.id) FILTER (WHERE m.classification = 'good') as good_moves,
    COUNT(m.id) FILTER (WHERE m.classification = 'inaccuracy') as inaccuracies,
    COUNT(m.id) FILTER (WHERE m.classification = 'mistake') as mistakes,
    COUNT(m.id) FILTER (WHERE m.classification = 'blunder') as blunders,
    ROUND(AVG(m.eval_delta), 2) as avg_eval_delta,
    ROUND(COUNT(m.id) FILTER (WHERE m.classification IN ('mistake', 'blunder')) * 100.0 / COUNT(m.id), 2) as mistake_rate
FROM games g
LEFT JOIN moves m ON g.id = m.game_id
WHERE g.eco IS NOT NULL
GROUP BY g.eco, g.opening_name
HAVING COUNT(m.id) > 0
ORDER BY mistake_rate DESC;

CREATE VIEW mistakes_by_phase AS
SELECT 
    phase,
    COUNT(*) as total_moves,
    COUNT(*) FILTER (WHERE classification = 'good') as good_moves,
    COUNT(*) FILTER (WHERE classification = 'inaccuracy') as inaccuracies,
    COUNT(*) FILTER (WHERE classification = 'mistake') as mistakes,
    COUNT(*) FILTER (WHERE classification = 'blunder') as blunders,
    ROUND(AVG(eval_delta), 2) as avg_eval_delta,
    ROUND(COUNT(*) FILTER (WHERE classification IN ('mistake', 'blunder')) * 100.0 / COUNT(*), 2) as mistake_rate
FROM moves
GROUP BY phase
ORDER BY 
    CASE phase 
        WHEN 'opening' THEN 1 
        WHEN 'middlegame' THEN 2 
        WHEN 'endgame' THEN 3 
    END;

CREATE VIEW mistakes_by_time_control AS
SELECT 
    g.time_control,
    COUNT(DISTINCT g.id) as games_played,
    COUNT(m.id) as total_moves,
    COUNT(m.id) FILTER (WHERE m.classification = 'good') as good_moves,
    COUNT(m.id) FILTER (WHERE m.classification = 'inaccuracy') as inaccuracies,
    COUNT(m.id) FILTER (WHERE m.classification = 'mistake') as mistakes,
    COUNT(m.id) FILTER (WHERE m.classification = 'blunder') as blunders,
    ROUND(AVG(m.eval_delta), 2) as avg_eval_delta,
    ROUND(COUNT(m.id) FILTER (WHERE m.classification IN ('mistake', 'blunder')) * 100.0 / COUNT(m.id), 2) as mistake_rate
FROM games g
LEFT JOIN moves m ON g.id = m.game_id
WHERE g.time_control IS NOT NULL
GROUP BY g.time_control
HAVING COUNT(m.id) > 0
ORDER BY mistake_rate DESC;

-- Overall statistics view
CREATE VIEW game_statistics AS
SELECT 
    COUNT(DISTINCT g.id) as total_games,
    COUNT(m.id) as total_moves,
    COUNT(m.id) FILTER (WHERE m.classification = 'good') as good_moves,
    COUNT(m.id) FILTER (WHERE m.classification = 'inaccuracy') as inaccuracies,
    COUNT(m.id) FILTER (WHERE m.classification = 'mistake') as mistakes,
    COUNT(m.id) FILTER (WHERE m.classification = 'blunder') as blunders,
    ROUND(AVG(m.eval_delta), 2) as avg_eval_delta,
    ROUND(COUNT(m.id) FILTER (WHERE m.classification = 'good') * 100.0 / COUNT(m.id), 2) as accuracy_percentage,
    ROUND(COUNT(m.id) FILTER (WHERE m.classification IN ('mistake', 'blunder')) * 100.0 / COUNT(m.id), 2) as mistake_rate
FROM games g
LEFT JOIN moves m ON g.id = m.game_id;

-- Function to get phase from ply
CREATE OR REPLACE FUNCTION get_phase_from_ply(ply INTEGER)
RETURNS game_phase AS $$
BEGIN
    IF ply <= 30 THEN
        RETURN 'opening';
    ELSIF ply <= 80 THEN
        RETURN 'middlegame';
    ELSE
        RETURN 'endgame';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to classify move based on eval delta
CREATE OR REPLACE FUNCTION classify_move(eval_delta INTEGER)
RETURNS move_classification AS $$
BEGIN
    IF eval_delta >= -50 THEN
        RETURN 'good';
    ELSIF eval_delta >= -150 THEN
        RETURN 'inaccuracy';
    ELSIF eval_delta >= -300 THEN
        RETURN 'mistake';
    ELSE
        RETURN 'blunder';
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Tactical motifs analysis view
CREATE VIEW tactical_insights AS
SELECT 
    jsonb_array_elements(tactical_motifs)->>'motif_type' as motif_type,
    jsonb_array_elements(tactical_motifs)->>'description' as description,
    jsonb_array_elements(tactical_motifs)->>'severity' as severity,
    jsonb_array_elements(tactical_motifs)->>'piece_involved' as piece_involved,
    COUNT(*) as frequency,
    AVG(eval_delta) as avg_eval_delta,
    COUNT(*) FILTER (WHERE classification IN ('mistake', 'blunder')) as mistakes_count
FROM moves 
WHERE tactical_motifs IS NOT NULL 
GROUP BY motif_type, description, severity, piece_involved
ORDER BY frequency DESC;

-- Positional patterns analysis view
CREATE VIEW positional_insights AS
SELECT 
    jsonb_array_elements(positional_patterns)->>'pattern_type' as pattern_type,
    jsonb_array_elements(positional_patterns)->>'description' as description,
    jsonb_array_elements(positional_patterns)->>'severity' as severity,
    jsonb_array_elements(positional_patterns)->>'recommendation' as recommendation,
    COUNT(*) as frequency,
    AVG(eval_delta) as avg_eval_delta,
    COUNT(*) FILTER (WHERE classification IN ('mistake', 'blunder')) as mistakes_count
FROM moves 
WHERE positional_patterns IS NOT NULL 
GROUP BY pattern_type, description, severity, recommendation
ORDER BY frequency DESC;

-- Common mistake patterns view
CREATE VIEW mistake_patterns AS
SELECT 
    piece_moved,
    phase,
    move_quality,
    COUNT(*) as total_moves,
    COUNT(*) FILTER (WHERE classification = 'blunder') as blunders,
    COUNT(*) FILTER (WHERE classification = 'mistake') as mistakes,
    AVG(eval_delta) as avg_eval_delta,
    ROUND(COUNT(*) FILTER (WHERE classification IN ('mistake', 'blunder')) * 100.0 / COUNT(*), 2) as mistake_rate
FROM moves
WHERE classification IN ('mistake', 'blunder')
GROUP BY piece_moved, phase, move_quality
ORDER BY mistake_rate DESC;

-- Mistakes by tactical motif view
CREATE VIEW mistakes_by_motif AS
SELECT 
    jsonb_array_elements(tactical_motifs)->>'motif_type' as motif_type,
    COUNT(*) as total_moves,
    COUNT(*) FILTER (WHERE classification = 'good') as good_moves,
    COUNT(*) FILTER (WHERE classification = 'inaccuracy') as inaccuracies,
    COUNT(*) FILTER (WHERE classification = 'mistake') as mistakes,
    COUNT(*) FILTER (WHERE classification = 'blunder') as blunders,
    ROUND(AVG(eval_delta), 2) as avg_eval_delta,
    ROUND(COUNT(*) FILTER (WHERE classification IN ('mistake', 'blunder')) * 100.0 / COUNT(*), 2) as mistake_rate
FROM moves
WHERE tactical_motifs IS NOT NULL
GROUP BY motif_type
ORDER BY mistake_rate DESC;
