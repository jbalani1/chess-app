-- Opening Categorization & Enhanced Filtering Schema
-- Adds color-specific opening analysis and improved filtering capabilities

-- =============================================================================
-- ADD USER COLOR TO GAMES (computed from username vs white_player)
-- =============================================================================

-- Add column to store user's color explicitly (faster queries than computing each time)
ALTER TABLE games
ADD COLUMN user_color VARCHAR(5) GENERATED ALWAYS AS (
    CASE
        WHEN LOWER(username) = LOWER(white_player) THEN 'white'
        WHEN LOWER(username) = LOWER(black_player) THEN 'black'
        ELSE 'unknown'
    END
) STORED;

CREATE INDEX idx_games_user_color ON games(user_color);

-- =============================================================================
-- OPENING TAXONOMY TABLE
-- =============================================================================

-- Normalized opening categories for better grouping
CREATE TABLE opening_categories (
    eco_prefix VARCHAR(3) PRIMARY KEY,  -- e.g., 'B90' or 'B9' or 'B'
    category_name VARCHAR(100) NOT NULL,
    parent_category VARCHAR(100),
    description TEXT,
    typical_player VARCHAR(10)  -- 'white', 'black', or 'both'
);

-- Populate with common opening categories
INSERT INTO opening_categories (eco_prefix, category_name, parent_category, typical_player) VALUES
-- Open Games (1.e4 e5)
('C', 'Open Games', NULL, 'both'),
('C00', 'French Defense', 'Semi-Open Games', 'black'),
('C20', 'King Pawn Game', 'Open Games', 'white'),
('C40', 'King Knight Opening', 'Open Games', 'white'),
('C42', 'Petrov Defense', 'Open Games', 'black'),
('C44', 'Scotch Game', 'Open Games', 'white'),
('C50', 'Italian Game', 'Open Games', 'white'),
('C60', 'Ruy Lopez', 'Open Games', 'white'),

-- Semi-Open Games (1.e4, not 1...e5)
('B', 'Semi-Open Games', NULL, 'both'),
('B00', 'Uncommon King Pawn', 'Semi-Open Games', 'black'),
('B10', 'Caro-Kann Defense', 'Semi-Open Games', 'black'),
('B20', 'Sicilian Defense', 'Semi-Open Games', 'black'),
('B30', 'Sicilian Defense', 'Semi-Open Games', 'black'),
('B40', 'Sicilian Defense', 'Semi-Open Games', 'black'),
('B50', 'Sicilian Defense', 'Semi-Open Games', 'black'),
('B60', 'Sicilian Najdorf', 'Semi-Open Games', 'black'),
('B70', 'Sicilian Dragon', 'Semi-Open Games', 'black'),
('B80', 'Sicilian Scheveningen', 'Semi-Open Games', 'black'),
('B90', 'Sicilian Najdorf', 'Semi-Open Games', 'black'),

-- Closed Games (1.d4 d5)
('D', 'Closed Games', NULL, 'both'),
('D00', 'Queen Pawn Game', 'Closed Games', 'white'),
('D10', 'Slav Defense', 'Closed Games', 'black'),
('D30', 'Queen''s Gambit Declined', 'Closed Games', 'black'),
('D50', 'Queen''s Gambit Declined', 'Closed Games', 'black'),
('D70', 'Grünfeld Defense', 'Closed Games', 'black'),
('D80', 'Grünfeld Defense', 'Closed Games', 'black'),

-- Indian Defenses (1.d4 Nf6)
('E', 'Indian Defenses', NULL, 'black'),
('E00', 'Catalan Opening', 'Indian Defenses', 'white'),
('E10', 'Indian Defense', 'Indian Defenses', 'black'),
('E20', 'Nimzo-Indian Defense', 'Indian Defenses', 'black'),
('E30', 'Nimzo-Indian Defense', 'Indian Defenses', 'black'),
('E40', 'Nimzo-Indian Defense', 'Indian Defenses', 'black'),
('E60', 'King''s Indian Defense', 'Indian Defenses', 'black'),
('E70', 'King''s Indian Defense', 'Indian Defenses', 'black'),
('E80', 'King''s Indian Defense', 'Indian Defenses', 'black'),
('E90', 'King''s Indian Defense', 'Indian Defenses', 'black'),

-- Flank Openings
('A', 'Flank Openings', NULL, 'white'),
('A00', 'Uncommon Openings', 'Flank Openings', 'white'),
('A10', 'English Opening', 'Flank Openings', 'white'),
('A20', 'English Opening', 'Flank Openings', 'white'),
('A30', 'English Opening', 'Flank Openings', 'white'),
('A40', 'Queen Pawn Game', 'Flank Openings', 'white'),
('A45', 'Trompowsky Attack', 'Flank Openings', 'white'),
('A50', 'Indian Defense', 'Flank Openings', 'black'),
('A80', 'Dutch Defense', 'Flank Openings', 'black')

ON CONFLICT (eco_prefix) DO NOTHING;

-- =============================================================================
-- VIEWS: OPENINGS BY COLOR
-- =============================================================================

-- User's White Repertoire (what they play as white)
CREATE VIEW white_repertoire AS
SELECT
    g.eco,
    g.opening_name,
    COUNT(*) as games_played,
    COUNT(*) FILTER (WHERE g.result = '1-0') as wins,
    COUNT(*) FILTER (WHERE g.result = '0-1') as losses,
    COUNT(*) FILTER (WHERE g.result = '1/2-1/2') as draws,
    ROUND(COUNT(*) FILTER (WHERE g.result = '1-0') * 100.0 / NULLIF(COUNT(*), 0), 1) as win_rate,
    ROUND(AVG(m.eval_delta) FILTER (WHERE m.classification IN ('mistake', 'blunder')), 0) as avg_mistake_severity,
    COUNT(m.id) FILTER (WHERE m.classification IN ('mistake', 'blunder')) as total_mistakes
FROM games g
LEFT JOIN moves m ON g.id = m.game_id
WHERE g.user_color = 'white'
GROUP BY g.eco, g.opening_name
HAVING COUNT(*) >= 1
ORDER BY games_played DESC;

-- User's Black Repertoire (what they play as black)
CREATE VIEW black_repertoire AS
SELECT
    g.eco,
    g.opening_name,
    COUNT(*) as games_played,
    COUNT(*) FILTER (WHERE g.result = '0-1') as wins,  -- Black wins when result is 0-1
    COUNT(*) FILTER (WHERE g.result = '1-0') as losses,
    COUNT(*) FILTER (WHERE g.result = '1/2-1/2') as draws,
    ROUND(COUNT(*) FILTER (WHERE g.result = '0-1') * 100.0 / NULLIF(COUNT(*), 0), 1) as win_rate,
    ROUND(AVG(m.eval_delta) FILTER (WHERE m.classification IN ('mistake', 'blunder')), 0) as avg_mistake_severity,
    COUNT(m.id) FILTER (WHERE m.classification IN ('mistake', 'blunder')) as total_mistakes
FROM games g
LEFT JOIN moves m ON g.id = m.game_id
WHERE g.user_color = 'black'
GROUP BY g.eco, g.opening_name
HAVING COUNT(*) >= 1
ORDER BY games_played DESC;

-- Combined opening performance with color context
CREATE VIEW opening_performance AS
SELECT
    g.eco,
    g.opening_name,
    g.user_color,
    COUNT(DISTINCT g.id) as games_played,
    ROUND(
        CASE g.user_color
            WHEN 'white' THEN COUNT(*) FILTER (WHERE g.result = '1-0') * 100.0 / NULLIF(COUNT(DISTINCT g.id), 0)
            WHEN 'black' THEN COUNT(*) FILTER (WHERE g.result = '0-1') * 100.0 / NULLIF(COUNT(DISTINCT g.id), 0)
        END, 1
    ) as win_rate,
    COUNT(m.id) FILTER (WHERE m.classification IN ('mistake', 'blunder')) as total_mistakes,
    COUNT(m.id) as total_moves,
    ROUND(
        COUNT(m.id) FILTER (WHERE m.classification IN ('mistake', 'blunder')) * 100.0 / NULLIF(COUNT(m.id), 0),
        1
    ) as mistake_rate
FROM games g
LEFT JOIN moves m ON g.id = m.game_id
GROUP BY g.eco, g.opening_name, g.user_color
HAVING COUNT(DISTINCT g.id) >= 1
ORDER BY games_played DESC;

-- =============================================================================
-- VIEWS: MISTAKES BY PIECE (enhanced with filters)
-- =============================================================================

-- Mistakes by piece with game context (for filtering)
CREATE VIEW mistakes_by_piece_detailed AS
SELECT
    m.piece_moved,
    m.phase,
    g.user_color,
    g.time_control,
    g.eco,
    COUNT(*) as total_moves,
    COUNT(*) FILTER (WHERE m.classification = 'good') as good_moves,
    COUNT(*) FILTER (WHERE m.classification = 'inaccuracy') as inaccuracies,
    COUNT(*) FILTER (WHERE m.classification = 'mistake') as mistakes,
    COUNT(*) FILTER (WHERE m.classification = 'blunder') as blunders,
    ROUND(AVG(m.eval_delta), 2) as avg_eval_delta,
    ROUND(COUNT(*) FILTER (WHERE m.classification IN ('mistake', 'blunder')) * 100.0 / COUNT(*), 2) as mistake_rate
FROM moves m
JOIN games g ON m.game_id = g.id
GROUP BY m.piece_moved, m.phase, g.user_color, g.time_control, g.eco
ORDER BY mistake_rate DESC;

-- Simplified piece mistakes (overall, but filterable via function)
CREATE OR REPLACE FUNCTION get_mistakes_by_piece(
    p_phase game_phase DEFAULT NULL,
    p_user_color VARCHAR DEFAULT NULL,
    p_time_control VARCHAR DEFAULT NULL,
    p_eco VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    piece_moved VARCHAR,
    total_moves BIGINT,
    good_moves BIGINT,
    inaccuracies BIGINT,
    mistakes BIGINT,
    blunders BIGINT,
    avg_eval_delta NUMERIC,
    mistake_rate NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.piece_moved,
        COUNT(*)::BIGINT as total_moves,
        COUNT(*) FILTER (WHERE m.classification = 'good')::BIGINT as good_moves,
        COUNT(*) FILTER (WHERE m.classification = 'inaccuracy')::BIGINT as inaccuracies,
        COUNT(*) FILTER (WHERE m.classification = 'mistake')::BIGINT as mistakes,
        COUNT(*) FILTER (WHERE m.classification = 'blunder')::BIGINT as blunders,
        ROUND(AVG(m.eval_delta), 2) as avg_eval_delta,
        ROUND(COUNT(*) FILTER (WHERE m.classification IN ('mistake', 'blunder')) * 100.0 / COUNT(*), 2) as mistake_rate
    FROM moves m
    JOIN games g ON m.game_id = g.id
    WHERE (p_phase IS NULL OR m.phase = p_phase)
      AND (p_user_color IS NULL OR g.user_color = p_user_color)
      AND (p_time_control IS NULL OR g.time_control = p_time_control)
      AND (p_eco IS NULL OR g.eco = p_eco)
    GROUP BY m.piece_moved
    ORDER BY mistake_rate DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VIEWS: GAMES WITH OPENING FILTER SUPPORT
-- =============================================================================

-- Games list with opening category
CREATE VIEW games_with_opening_category AS
SELECT
    g.*,
    oc.category_name as opening_category,
    oc.parent_category as opening_parent_category
FROM games g
LEFT JOIN opening_categories oc ON (
    -- Match most specific first (e.g., B90), then less specific (B9, B)
    oc.eco_prefix = g.eco
    OR oc.eco_prefix = LEFT(g.eco, 2)
    OR oc.eco_prefix = LEFT(g.eco, 1)
)
WHERE oc.eco_prefix IS NULL
   OR oc.eco_prefix = (
       SELECT MAX(eco_prefix)
       FROM opening_categories
       WHERE g.eco LIKE eco_prefix || '%'
   );

-- =============================================================================
-- FUNCTION: GET FILTERED MISTAKES
-- =============================================================================

CREATE OR REPLACE FUNCTION get_filtered_mistakes(
    p_piece_moved VARCHAR DEFAULT NULL,
    p_phase game_phase DEFAULT NULL,
    p_user_color VARCHAR DEFAULT NULL,
    p_time_control VARCHAR DEFAULT NULL,
    p_eco VARCHAR DEFAULT NULL,
    p_classification VARCHAR DEFAULT NULL,  -- 'mistake', 'blunder', or NULL for both
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    move_id UUID,
    game_id UUID,
    ply INTEGER,
    move_san VARCHAR,
    piece_moved VARCHAR,
    phase game_phase,
    classification move_classification,
    eval_before INTEGER,
    eval_after INTEGER,
    eval_delta INTEGER,
    position_fen VARCHAR,
    played_at TIMESTAMPTZ,
    opening_name VARCHAR,
    user_color VARCHAR,
    time_control VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        m.id as move_id,
        m.game_id,
        m.ply,
        m.move_san,
        m.piece_moved,
        m.phase,
        m.classification,
        m.eval_before,
        m.eval_after,
        m.eval_delta,
        m.position_fen,
        g.played_at,
        g.opening_name,
        g.user_color,
        g.time_control
    FROM moves m
    JOIN games g ON m.game_id = g.id
    WHERE m.classification IN ('mistake', 'blunder')
      AND (p_piece_moved IS NULL OR m.piece_moved = p_piece_moved)
      AND (p_phase IS NULL OR m.phase = p_phase)
      AND (p_user_color IS NULL OR g.user_color = p_user_color)
      AND (p_time_control IS NULL OR g.time_control = p_time_control)
      AND (p_eco IS NULL OR g.eco = p_eco OR g.eco LIKE p_eco || '%')
      AND (p_classification IS NULL OR m.classification::TEXT = p_classification)
    ORDER BY g.played_at DESC, m.ply
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- SUMMARY VIEW: FILTER OPTIONS
-- =============================================================================

-- Available filter values (for UI dropdowns)
CREATE VIEW available_filters AS
SELECT
    'pieces' as filter_type,
    jsonb_agg(DISTINCT piece_moved ORDER BY piece_moved) as values
FROM moves
WHERE piece_moved IS NOT NULL
UNION ALL
SELECT
    'phases' as filter_type,
    jsonb_agg(DISTINCT phase ORDER BY phase) as values
FROM moves
WHERE phase IS NOT NULL
UNION ALL
SELECT
    'time_controls' as filter_type,
    jsonb_agg(DISTINCT time_control ORDER BY time_control) as values
FROM games
WHERE time_control IS NOT NULL
UNION ALL
SELECT
    'openings' as filter_type,
    jsonb_agg(DISTINCT jsonb_build_object('eco', eco, 'name', opening_name) ORDER BY eco) as values
FROM games
WHERE eco IS NOT NULL
UNION ALL
SELECT
    'user_colors' as filter_type,
    jsonb_agg(DISTINCT user_color ORDER BY user_color) as values
FROM games
WHERE user_color IS NOT NULL;

-- =============================================================================
-- INDEX FOR COMMON FILTER QUERIES
-- =============================================================================

CREATE INDEX idx_moves_piece_classification ON moves(piece_moved, classification);
CREATE INDEX idx_moves_phase_classification ON moves(phase, classification);
CREATE INDEX idx_games_eco_user_color ON games(eco, user_color);
CREATE INDEX idx_games_time_control_user_color ON games(time_control, user_color);
