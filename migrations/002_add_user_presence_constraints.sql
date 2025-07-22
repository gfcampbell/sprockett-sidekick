-- =============================================================================
-- SAFE Migration: Add constraints to existing user_presence table
-- This only adds missing indexes and constraints without losing data
-- =============================================================================

-- STEP 0: Add room_token column for security tokens
ALTER TABLE user_presence ADD COLUMN IF NOT EXISTS room_token TEXT NULL;

-- STEP 1: Clean up any duplicate records first (keeping the newest)
WITH ranked_presence AS (
    SELECT id, host_id, 
           ROW_NUMBER() OVER (PARTITION BY host_id ORDER BY updated_at DESC) as rn
    FROM user_presence
)
DELETE FROM user_presence 
WHERE id IN (
    SELECT id FROM ranked_presence WHERE rn > 1
);

-- STEP 2: Now add unique constraint on host_id to prevent duplicate records
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_presence_host_unique ON user_presence(host_id);

-- STEP 3: Add performance indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_presence_host_available ON user_presence(host_id, is_available);
CREATE INDEX IF NOT EXISTS idx_user_presence_updated_at ON user_presence(updated_at);

-- STEP 4: Add auto-update timestamp trigger if it doesn't exist
CREATE OR REPLACE FUNCTION update_user_presence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_user_presence_updated_at_trigger ON user_presence;
CREATE TRIGGER update_user_presence_updated_at_trigger
    BEFORE UPDATE ON user_presence 
    FOR EACH ROW 
    EXECUTE FUNCTION update_user_presence_updated_at();

-- STEP 5: Add helpful comments
COMMENT ON TABLE user_presence IS 'Tracks host availability for Oblivion embed widgets';
COMMENT ON COLUMN user_presence.host_id IS 'Host identifier from data-host-id attribute';
COMMENT ON COLUMN user_presence.is_available IS 'Whether the host is currently available for calls';
COMMENT ON COLUMN user_presence.room_id IS 'Room ID where the host is available';
COMMENT ON COLUMN user_presence.room_token IS 'Security token for encrypted room access';
COMMENT ON COLUMN user_presence.updated_at IS 'Last update timestamp for expiry checks'; 