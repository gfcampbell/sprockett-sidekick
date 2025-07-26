-- =============================================================================
-- Sprockett Sidekick - Complete Database Schema
-- Single migration to recreate entire database from scratch
-- =============================================================================

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- User Management Tables
-- =============================================================================

-- User accounts for token tracking and billing
CREATE TABLE IF NOT EXISTS user_accounts (
    user_id TEXT PRIMARY KEY,  -- Supabase auth.users.id
    email TEXT,
    tokens_remaining INTEGER NOT NULL DEFAULT 100,
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User presence tracking
CREATE TABLE IF NOT EXISTS user_presence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    is_available BOOLEAN DEFAULT FALSE,
    room_id TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- Session and Billing Tables
-- =============================================================================

-- Call sessions for billing and analytics
CREATE TABLE IF NOT EXISTS call_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id TEXT NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE NULL,
    mode TEXT NOT NULL CHECK (mode IN ('video', 'voice-only')),
    used_turn BOOLEAN DEFAULT FALSE,
    credit_cost NUMERIC(10,4) DEFAULT 0.00,
    user_id TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Token usage tracking for detailed billing
CREATE TABLE IF NOT EXISTS token_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,  -- References call_sessions.id
    tokens_used INTEGER NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mode TEXT NOT NULL CHECK (mode IN ('voice', 'video')),
    used_turn BOOLEAN NOT NULL,
    duration_seconds INTEGER NULL
);

-- Token transaction history
CREATE TABLE IF NOT EXISTS token_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'bonus')),
    tokens INTEGER NOT NULL,  -- Positive for additions, negative for usage
    amount_usd NUMERIC(10,2) NULL,  -- For purchases
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Token packages for purchase options
CREATE TABLE IF NOT EXISTS token_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    tokens INTEGER NOT NULL,
    price_usd NUMERIC(10,2) NOT NULL,
    price_per_token NUMERIC(10,4) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================================================
-- Indexes for Performance
-- =============================================================================

-- User accounts indexes
CREATE INDEX IF NOT EXISTS idx_user_accounts_email ON user_accounts(email);
CREATE INDEX IF NOT EXISTS idx_user_accounts_created_at ON user_accounts(created_at);

-- User presence indexes
CREATE INDEX IF NOT EXISTS idx_user_presence_user_id ON user_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_room_id ON user_presence(room_id);
CREATE INDEX IF NOT EXISTS idx_user_presence_updated_at ON user_presence(updated_at);

-- Call sessions indexes
CREATE INDEX IF NOT EXISTS idx_call_sessions_room_id ON call_sessions(room_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_start_time ON call_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_call_sessions_used_turn ON call_sessions(used_turn);
CREATE INDEX IF NOT EXISTS idx_call_sessions_user_id ON call_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_billing ON call_sessions(used_turn, start_time);

-- Token usage indexes
CREATE INDEX IF NOT EXISTS idx_token_usage_user_id ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_session_id ON token_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_timestamp ON token_usage(timestamp);

-- Token transactions indexes
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(transaction_type);

-- Token packages indexes
CREATE INDEX IF NOT EXISTS idx_token_packages_active ON token_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_token_packages_price ON token_packages(price_usd);

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_packages ENABLE ROW LEVEL SECURITY;

-- User accounts policies
CREATE POLICY "Users can read own account" ON user_accounts
    FOR SELECT USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can update own account" ON user_accounts
    FOR UPDATE USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Allow service role full access to user_accounts" ON user_accounts
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- User presence policies
CREATE POLICY "Allow read for anyone" ON user_presence
    FOR SELECT USING (true);

CREATE POLICY "Allow update by self" ON user_presence
    FOR UPDATE USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Allow service role full access to user_presence" ON user_presence
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Call sessions policies
CREATE POLICY "Users can read own sessions" ON call_sessions
    FOR SELECT USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Allow service role full access to call_sessions" ON call_sessions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Token usage policies
CREATE POLICY "Users can read own token usage" ON token_usage
    FOR SELECT USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Allow service role full access to token_usage" ON token_usage
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Token transactions policies
CREATE POLICY "Users can read own transactions" ON token_transactions
    FOR SELECT USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Allow service role full access to token_transactions" ON token_transactions
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Token packages policies (public read access)
CREATE POLICY "Allow public read access to token_packages" ON token_packages
    FOR SELECT USING (is_active = true);

CREATE POLICY "Allow service role full access to token_packages" ON token_packages
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================================================
-- Triggers for Updated At
-- =============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

-- Triggers to automatically update updated_at
CREATE TRIGGER update_user_accounts_updated_at 
    BEFORE UPDATE ON user_accounts 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_call_sessions_updated_at 
    BEFORE UPDATE ON call_sessions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_token_packages_updated_at 
    BEFORE UPDATE ON token_packages 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- Analytics Views
-- =============================================================================

-- Active calls view
CREATE OR REPLACE VIEW active_calls AS
SELECT 
    id,
    room_id,
    mode,
    used_turn,
    start_time,
    NOW() - start_time AS duration,
    user_id
FROM call_sessions 
WHERE end_time IS NULL
ORDER BY start_time DESC;

-- Daily billing summary
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
  AND end_time IS NOT NULL
GROUP BY DATE(start_time)
ORDER BY call_date DESC;

-- User token summary
CREATE OR REPLACE VIEW user_token_summary AS
SELECT 
    ua.user_id,
    ua.email,
    ua.tokens_remaining,
    ua.subscription_tier,
    COALESCE(SUM(tu.tokens_used), 0) AS total_tokens_used,
    COUNT(DISTINCT cs.id) AS total_sessions,
    ua.created_at AS account_created
FROM user_accounts ua
LEFT JOIN token_usage tu ON ua.user_id = tu.user_id
LEFT JOIN call_sessions cs ON ua.user_id = cs.user_id
GROUP BY ua.user_id, ua.email, ua.tokens_remaining, ua.subscription_tier, ua.created_at
ORDER BY ua.created_at DESC;

-- Daily token usage
CREATE OR REPLACE VIEW daily_token_usage AS
SELECT 
    DATE(tu.timestamp) AS usage_date,
    COUNT(*) AS total_operations,
    SUM(tu.tokens_used) AS total_tokens,
    COUNT(DISTINCT tu.user_id) AS unique_users,
    AVG(tu.tokens_used) AS avg_tokens_per_operation
FROM token_usage tu
WHERE tu.timestamp >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(tu.timestamp)
ORDER BY usage_date DESC;

-- =============================================================================
-- Initial Data (Optional)
-- =============================================================================

-- Default token packages
INSERT INTO token_packages (name, tokens, price_usd, price_per_token, is_active) VALUES
('Starter Pack', 100, 15.00, 0.15, true),
('Value Pack', 500, 50.00, 0.10, true),
('Power Pack', 1000, 75.00, 0.075, true),
('Enterprise Pack', 5000, 250.00, 0.05, true)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Comments for Documentation
-- =============================================================================

COMMENT ON TABLE user_accounts IS 'User accounts with token balances and subscription info';
COMMENT ON TABLE user_presence IS 'Real-time user presence tracking';
COMMENT ON TABLE call_sessions IS 'Coaching session records for billing and analytics';
COMMENT ON TABLE token_usage IS 'Detailed token usage tracking per operation';
COMMENT ON TABLE token_transactions IS 'Complete transaction history for tokens';
COMMENT ON TABLE token_packages IS 'Available token packages for purchase';

COMMENT ON COLUMN user_accounts.user_id IS 'Supabase auth.users.id (UUID as TEXT)';
COMMENT ON COLUMN user_accounts.tokens_remaining IS 'Current token balance';
COMMENT ON COLUMN call_sessions.mode IS 'Session type: video or voice-only';
COMMENT ON COLUMN token_usage.mode IS 'Operation type: voice or video';
COMMENT ON COLUMN token_usage.session_id IS 'References call_sessions.id';
COMMENT ON COLUMN token_transactions.tokens IS 'Token change: positive=add, negative=use';

-- =============================================================================
-- Schema Version
-- =============================================================================

-- Track schema version for future migrations
CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    description TEXT,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO schema_version (version, description) VALUES 
(1, 'Initial clean schema - Sprockett Sidekick v1.0')
ON CONFLICT DO NOTHING;