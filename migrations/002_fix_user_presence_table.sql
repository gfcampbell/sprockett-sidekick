-- =============================================================================
-- Fix User Presence Table for Oblivion Embed System
-- This migration fixes the user_presence table to work with our embed widget
-- =============================================================================

-- Drop the existing user_presence table if it exists (since it has wrong schema)
DROP TABLE IF EXISTS user_presence;

-- Create the corrected user_presence table
CREATE TABLE user_presence (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Host identifier (this is what our code uses)
    host_id TEXT NOT NULL,
    
    -- Availability status
    is_available BOOLEAN DEFAULT true,
    
    -- Room they're available in
    room_id TEXT NOT NULL,
    
    -- Timestamp for expiry checks
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- Unique Constraint for UPSERT
-- =============================================================================

-- Ensure only one presence record per host
-- This allows our "resolution=merge-duplicates" to work properly
CREATE UNIQUE INDEX idx_user_presence_host_unique ON user_presence(host_id);

-- =============================================================================
-- Performance Indexes
-- =============================================================================

-- Index for checking host availability
CREATE INDEX idx_user_presence_host_available ON user_presence(host_id, is_available);

-- Index for time-based cleanup queries
CREATE INDEX idx_user_presence_updated_at ON user_presence(updated_at);

-- =============================================================================
-- Auto-update timestamp trigger
-- =============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_presence_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_presence_updated_at_trigger
    BEFORE UPDATE ON user_presence 
    FOR EACH ROW 
    EXECUTE FUNCTION update_user_presence_updated_at();

-- =============================================================================
-- Row Level Security Setup
-- =============================================================================

-- Enable RLS
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (no auth required for embed widgets)
CREATE POLICY "Allow all operations on user_presence" ON user_presence
    FOR ALL 
    TO public 
    USING (true) 
    WITH CHECK (true);

-- =============================================================================
-- Comments for Documentation
-- =============================================================================

COMMENT ON TABLE user_presence IS 'Tracks host availability for Oblivion embed widgets';
COMMENT ON COLUMN user_presence.host_id IS 'Host identifier from data-host-id attribute';
COMMENT ON COLUMN user_presence.is_available IS 'Whether the host is currently available for calls';
COMMENT ON COLUMN user_presence.room_id IS 'Room ID where the host is available';
COMMENT ON COLUMN user_presence.updated_at IS 'Last update timestamp for expiry checks'; 