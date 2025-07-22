-- =============================================================================
-- Oblivion Call Sessions Table for Supabase
-- Tracks embedded calls, TURN usage, and billing data
-- =============================================================================

-- Create the call_sessions table
CREATE TABLE IF NOT EXISTS call_sessions (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Call identification
    room_id TEXT NOT NULL,
    
    -- Timing
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE NULL,
    
    -- Call configuration
    mode TEXT NOT NULL CHECK (mode IN ('video', 'voice-only')),
    
    -- Infrastructure usage
    used_turn BOOLEAN DEFAULT FALSE,
    
    -- Billing
    credit_cost NUMERIC(10,4) DEFAULT 0.00,
    
    -- Optional user tracking (for future auth)
    user_id TEXT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- Index on room_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_call_sessions_room_id ON call_sessions(room_id);

-- Index on start_time for time-based queries
CREATE INDEX IF NOT EXISTS idx_call_sessions_start_time ON call_sessions(start_time);

-- Index on used_turn for billing queries
CREATE INDEX IF NOT EXISTS idx_call_sessions_used_turn ON call_sessions(used_turn);

-- Index on user_id for when auth is added
CREATE INDEX IF NOT EXISTS idx_call_sessions_user_id ON call_sessions(user_id);

-- Composite index for billing reports
CREATE INDEX IF NOT EXISTS idx_call_sessions_billing ON call_sessions(used_turn, start_time);

-- =============================================================================
-- Row Level Security (RLS) Setup
-- =============================================================================

-- Enable RLS (but we'll keep policies open for now)
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (no auth yet)
-- You can restrict this later when you add authentication
CREATE POLICY "Allow all operations on call_sessions" ON call_sessions
    FOR ALL 
    TO public 
    USING (true) 
    WITH CHECK (true);

-- =============================================================================
-- Trigger for Updated At
-- =============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_call_sessions_updated_at 
    BEFORE UPDATE ON call_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Helper Views for Analytics
-- =============================================================================

-- View: Active calls (no end_time set)
CREATE OR REPLACE VIEW active_calls AS
SELECT 
    id,
    room_id,
    mode,
    used_turn,
    start_time,
    NOW() - start_time AS duration
FROM call_sessions 
WHERE end_time IS NULL
ORDER BY start_time DESC;

-- View: Billing summary by date
CREATE OR REPLACE VIEW daily_billing_summary AS
SELECT 
    DATE(start_time) AS call_date,
    COUNT(*) AS total_calls,
    COUNT(*) FILTER (WHERE used_turn = true) AS turn_calls,
    COUNT(*) FILTER (WHERE mode = 'video') AS video_calls,
    COUNT(*) FILTER (WHERE mode = 'voice-only') AS voice_calls,
    SUM(credit_cost) AS total_credits,
    AVG(EXTRACT(EPOCH FROM (end_time - start_time))/60) AS avg_duration_minutes
FROM call_sessions 
WHERE start_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(start_time)
ORDER BY call_date DESC;

-- =============================================================================
-- Sample Data (Optional - Remove in Production)
-- =============================================================================

-- Uncomment to insert sample data for testing
/*
INSERT INTO call_sessions (room_id, mode, used_turn, credit_cost) VALUES
('demo123', 'video', false, 0.00),
('demo456', 'voice-only', true, 0.05),
('demo789', 'video', true, 0.08);
*/

-- =============================================================================
-- Comments for Documentation
-- =============================================================================

COMMENT ON TABLE call_sessions IS 'Tracks Oblivion embedded call sessions for billing and analytics';
COMMENT ON COLUMN call_sessions.id IS 'Unique session identifier';
COMMENT ON COLUMN call_sessions.room_id IS 'Room identifier from window.oblivnRoomId';
COMMENT ON COLUMN call_sessions.start_time IS 'When the call session started';
COMMENT ON COLUMN call_sessions.end_time IS 'When the call session ended (NULL for active calls)';
COMMENT ON COLUMN call_sessions.mode IS 'Call type: video or voice-only';
COMMENT ON COLUMN call_sessions.used_turn IS 'Whether TURN relay servers were used (impacts billing)';
COMMENT ON COLUMN call_sessions.credit_cost IS 'Calculated cost in credits for this session';
COMMENT ON COLUMN call_sessions.user_id IS 'Optional user identifier for authenticated calls';

create table user_presence (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  is_available boolean default false,
  room_id text not null,
  updated_at timestamp with time zone default now()
);

-- Realtime presence feed
alter table user_presence enable row level security;

create policy "Allow read for anyone" on user_presence
  for select using (true);

create policy "Allow update by self" on user_presence
  for update using (auth.uid() = user_id); 