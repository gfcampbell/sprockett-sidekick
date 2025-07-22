-- =============================================================================
-- Sprint 2: Token Billing Tables for Oblivn
-- Creates user_accounts and token_usage tables for per-minute token billing
-- Compatible with current demo setup and future Supabase auth integration
-- =============================================================================

-- =============================================================================
-- USER ACCOUNTS TABLE
-- =============================================================================

-- Table for tracking user token balances
-- Note: user_id is TEXT for now (demo_user), but ready for Supabase auth UUIDs
CREATE TABLE IF NOT EXISTS user_accounts (
    -- User identifier (TEXT for demo, UUID for future auth)
    user_id TEXT PRIMARY KEY,
    
    -- Token balance
    tokens_remaining INTEGER NOT NULL DEFAULT 100,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Future auth fields (ready for Supabase auth integration)
    email TEXT NULL,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    
    -- Constraints
    CONSTRAINT positive_tokens CHECK (tokens_remaining >= 0)
);

-- =============================================================================
-- TOKEN USAGE TABLE  
-- =============================================================================

-- Table for logging all token usage events
CREATE TABLE IF NOT EXISTS token_usage (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign keys
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL, -- References call_sessions.id
    
    -- Usage details
    tokens_used INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Call configuration (for billing transparency)
    mode TEXT NOT NULL CHECK (mode IN ('voice', 'video')), 
    used_turn BOOLEAN NOT NULL,
    
    -- Duration tracking (for debugging and analytics)
    duration_seconds INTEGER NULL,
    
    -- Constraints
    CONSTRAINT positive_token_usage CHECK (tokens_used >= 0),
    CONSTRAINT valid_duration CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- User accounts indexes
CREATE INDEX IF NOT EXISTS idx_user_accounts_email ON user_accounts(email);
CREATE INDEX IF NOT EXISTS idx_user_accounts_tokens ON user_accounts(tokens_remaining);

-- Token usage indexes
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_session_id ON token_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage(timestamp);
CREATE INDEX IF NOT EXISTS idx_token_usage_mode ON token_usage(mode);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_token_usage_user_date ON token_usage(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_token_usage_billing ON token_usage(mode, used_turn, timestamp);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on both tables
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

-- Open policies for demo (will be restricted with auth later)
CREATE POLICY "Allow all operations on user_accounts" ON user_accounts
    FOR ALL 
    TO public 
    USING (true) 
    WITH CHECK (true);

CREATE POLICY "Allow all operations on token_usage" ON token_usage
    FOR ALL 
    TO public 
    USING (true) 
    WITH CHECK (true);

-- =============================================================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================================================

-- Trigger to automatically update updated_at on user_accounts
CREATE TRIGGER update_user_accounts_updated_at 
    BEFORE UPDATE ON user_accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Link token_usage to user_accounts
ALTER TABLE token_usage 
ADD CONSTRAINT fk_token_usage_user_id 
FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) 
ON DELETE CASCADE;

-- Note: session_id links to call_sessions.id, but we'll keep it as TEXT
-- since call_sessions.id is UUID and we want flexibility

-- =============================================================================
-- HELPER VIEWS FOR ANALYTICS
-- =============================================================================

-- View: User token balances with usage stats
CREATE OR REPLACE VIEW user_token_summary AS
SELECT 
    ua.user_id,
    ua.tokens_remaining,
    ua.subscription_tier,
    ua.created_at as account_created,
    COALESCE(usage_stats.total_tokens_used, 0) as total_tokens_used,
    COALESCE(usage_stats.total_sessions, 0) as total_sessions,
    COALESCE(usage_stats.last_usage, NULL) as last_usage
FROM user_accounts ua
LEFT JOIN (
    SELECT 
        user_id,
        SUM(tokens_used) as total_tokens_used,
        COUNT(*) as total_sessions,
        MAX(timestamp) as last_usage
    FROM token_usage
    GROUP BY user_id
) usage_stats ON ua.user_id = usage_stats.user_id;

-- View: Daily token usage summary
CREATE OR REPLACE VIEW daily_token_usage AS
SELECT 
    DATE(timestamp) as usage_date,
    mode,
    used_turn,
    COUNT(*) as session_count,
    SUM(tokens_used) as total_tokens,
    AVG(tokens_used) as avg_tokens_per_session,
    SUM(duration_seconds)/60.0 as total_minutes
FROM token_usage
WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(timestamp), mode, used_turn
ORDER BY usage_date DESC, mode, used_turn;

-- =============================================================================
-- DEMO DATA SETUP
-- =============================================================================

-- Insert demo user with starting tokens
INSERT INTO user_accounts (user_id, tokens_remaining, email, subscription_tier)
VALUES ('demo_user', 500, 'demo@oblivn.com', 'free')
ON CONFLICT (user_id) DO UPDATE SET
    tokens_remaining = GREATEST(user_accounts.tokens_remaining, 500), -- Don't reduce existing balance
    updated_at = NOW();

-- Insert a few additional test users for development
INSERT INTO user_accounts (user_id, tokens_remaining, email, subscription_tier) VALUES
('test_user_1', 100, 'test1@oblivn.com', 'free'),
('test_user_2', 250, 'test2@oblivn.com', 'pro'),
('developer', 1000, 'dev@oblivn.com', 'enterprise')
ON CONFLICT (user_id) DO NOTHING;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE user_accounts IS 'User accounts with token balances for billing';
COMMENT ON COLUMN user_accounts.user_id IS 'User identifier - TEXT for demo, will be UUID with Supabase auth';
COMMENT ON COLUMN user_accounts.tokens_remaining IS 'Current token balance (cannot go below 0)';
COMMENT ON COLUMN user_accounts.subscription_tier IS 'Subscription level affecting token rates and limits';

COMMENT ON TABLE token_usage IS 'Log of all token consumption events for billing transparency';
COMMENT ON COLUMN token_usage.user_id IS 'User who consumed the tokens';
COMMENT ON COLUMN token_usage.session_id IS 'Call session that consumed the tokens';
COMMENT ON COLUMN token_usage.tokens_used IS 'Number of tokens consumed (calculated by duration + mode + TURN)';
COMMENT ON COLUMN token_usage.mode IS 'Call mode: voice or video (affects token rate)';
COMMENT ON COLUMN token_usage.used_turn IS 'Whether TURN servers were used (affects token rate)';
COMMENT ON COLUMN token_usage.duration_seconds IS 'Session duration for audit and debugging';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify tables were created
SELECT 'Tables created successfully' as status;

-- Show demo user balance
SELECT user_id, tokens_remaining, subscription_tier 
FROM user_accounts 
WHERE user_id = 'demo_user';

-- Show all views
SELECT table_name as view_name 
FROM information_schema.views 
WHERE table_schema = 'public' 
  AND table_name IN ('user_token_summary', 'daily_token_usage'); 