-- Reclassify moves that were filed as errors although the evaluation improved
--
-- worker/ingest_recent.py graded moves on abs(eval_delta), so a move that
-- *gained* 300+cp — most often the engine's own best move when the score jumps
-- to a forced mate — was stored as a blunder. The ingester is fixed; this
-- repairs rows already written. It matches the rule in classify_move() (schema.sql):
-- eval_delta >= -50 is 'good'.
--
-- Run the preview first. The UPDATE keeps a copy of every row it changes in
-- moves_reclass_backup_20260919, so it can be reversed. Re-run
-- worker/aggregate_patterns.py afterwards so blunder_patterns reflects it.

-- 1. Preview: how many rows, by current label
SELECT classification::text, COUNT(*)
FROM moves
WHERE eval_delta >= -50 AND classification <> 'good'
GROUP BY 1 ORDER BY 2 DESC;

-- 2. Apply
BEGIN;

CREATE TABLE IF NOT EXISTS moves_reclass_backup_20260919 AS
SELECT id, classification, blunder_category, blunder_details, is_real_error
FROM moves
WHERE eval_delta >= -50 AND classification <> 'good';

UPDATE moves
SET classification   = 'good',
    blunder_category = NULL,
    blunder_details  = NULL,
    is_real_error    = false
WHERE eval_delta >= -50 AND classification <> 'good';

COMMIT;

-- To undo:
-- UPDATE moves m
-- SET classification = b.classification,
--     blunder_category = b.blunder_category,
--     blunder_details = b.blunder_details,
--     is_real_error = b.is_real_error
-- FROM moves_reclass_backup_20260919 b
-- WHERE m.id = b.id;
