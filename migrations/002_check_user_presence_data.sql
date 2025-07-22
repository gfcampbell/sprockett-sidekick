-- =============================================================================
-- SAFETY CHECK: Inspect user_presence table before making changes
-- Run this first to see what data exists
-- =============================================================================

-- Check if table exists and what columns it has
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_presence' 
ORDER BY ordinal_position;

-- Check what data is currently in the table
SELECT * FROM user_presence ORDER BY updated_at DESC LIMIT 20;

-- Count total records
SELECT COUNT(*) as total_records FROM user_presence;

-- Check for any unique host patterns
SELECT DISTINCT user_id FROM user_presence; -- if this column exists
SELECT DISTINCT host_id FROM user_presence; -- if this column exists 