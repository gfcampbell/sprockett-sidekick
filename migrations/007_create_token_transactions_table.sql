-- =============================================================================
-- Sprint 3: Token Transactions Table for Economics Dashboard
-- Creates token_transactions table for revenue tracking and profit calculation
-- =============================================================================

-- =============================================================================
-- TOKEN TRANSACTIONS TABLE
-- =============================================================================

-- Table for tracking all token-related financial transactions
CREATE TABLE IF NOT EXISTS token_transactions (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User reference
    user_id TEXT NOT NULL,
    
    -- Transaction details
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'bonus')),
    tokens INTEGER NOT NULL,  -- Positive for additions, negative for usage
    amount_usd NUMERIC(10,2) NULL,  -- For purchases (null for usage/bonus)
    
    -- Transaction metadata
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Optional payment metadata (for future Stripe integration)
    payment_method TEXT NULL,
    payment_id TEXT NULL,
    stripe_session_id TEXT NULL,
    
    -- Constraints
    CONSTRAINT valid_tokens CHECK (tokens != 0),
    CONSTRAINT purchase_has_amount CHECK (
        (transaction_type = 'purchase' AND amount_usd > 0) OR 
        (transaction_type != 'purchase')
    )
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Core indexes
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_id ON token_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_token_transactions_type ON token_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_token_transactions_created_at ON token_transactions(created_at);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_token_transactions_user_date ON token_transactions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_token_transactions_revenue ON token_transactions(transaction_type, created_at, amount_usd) 
    WHERE transaction_type = 'purchase';

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS
ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;

-- Open policy for demo (will be restricted with auth later)
CREATE POLICY "Allow all operations on token_transactions" ON token_transactions
    FOR ALL 
    TO public 
    USING (true) 
    WITH CHECK (true);

-- =============================================================================
-- FOREIGN KEY CONSTRAINTS
-- =============================================================================

-- Link to user_accounts
ALTER TABLE token_transactions 
ADD CONSTRAINT fk_token_transactions_user_id 
FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) 
ON DELETE CASCADE;

-- =============================================================================
-- HELPER VIEWS FOR ECONOMICS
-- =============================================================================

-- View: Revenue summary by time period
CREATE OR REPLACE VIEW revenue_summary AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    DATE_TRUNC('week', created_at) as week,
    DATE_TRUNC('month', created_at) as month,
    COUNT(*) as transaction_count,
    SUM(tokens) as tokens_sold,
    SUM(amount_usd) as revenue
FROM token_transactions
WHERE transaction_type = 'purchase'
GROUP BY DATE_TRUNC('day', created_at), DATE_TRUNC('week', created_at), DATE_TRUNC('month', created_at)
ORDER BY date DESC;

-- View: User purchase history
CREATE OR REPLACE VIEW user_purchase_history AS
SELECT 
    tt.user_id,
    ua.email,
    COUNT(*) as total_purchases,
    SUM(tt.tokens) as total_tokens_purchased,
    SUM(tt.amount_usd) as total_spent,
    AVG(tt.amount_usd) as avg_purchase_amount,
    MIN(tt.created_at) as first_purchase,
    MAX(tt.created_at) as last_purchase
FROM token_transactions tt
JOIN user_accounts ua ON tt.user_id = ua.user_id
WHERE tt.transaction_type = 'purchase'
GROUP BY tt.user_id, ua.email
ORDER BY total_spent DESC;

-- =============================================================================
-- DEMO DATA FOR TESTING
-- =============================================================================

-- Insert some sample purchase transactions for testing
-- (These will be replaced by real purchases in production)
INSERT INTO token_transactions (user_id, transaction_type, tokens, amount_usd, description, created_at) VALUES
-- Recent purchases for demo
('demo_user', 'purchase', 100, 15.00, 'Beta test purchase - 100 tokens', NOW() - INTERVAL '1 day'),
('demo_user', 'purchase', 500, 55.00, 'Beta test purchase - 500 tokens', NOW() - INTERVAL '3 days'),
('test_user_1', 'purchase', 1000, 70.00, 'Beta test purchase - 1000 tokens', NOW() - INTERVAL '5 days'),
('test_user_2', 'purchase', 100, 15.00, 'Beta test purchase - 100 tokens', NOW() - INTERVAL '7 days'),
('developer', 'purchase', 500, 55.00, 'Beta test purchase - 500 tokens', NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

-- Insert some usage transactions for completeness
INSERT INTO token_transactions (user_id, transaction_type, tokens, amount_usd, description, created_at) VALUES
('demo_user', 'usage', -25, NULL, 'Session billing - 25 minutes coaching', NOW() - INTERVAL '2 hours'),
('demo_user', 'usage', -15, NULL, 'Session billing - 15 minutes coaching', NOW() - INTERVAL '1 day'),
('test_user_1', 'usage', -45, NULL, 'Session billing - 45 minutes coaching', NOW() - INTERVAL '3 days'),
('test_user_2', 'usage', -30, NULL, 'Session billing - 30 minutes coaching', NOW() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;

-- =============================================================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================================================

COMMENT ON TABLE token_transactions IS 'Financial transaction log for token purchases, usage, and refunds';
COMMENT ON COLUMN token_transactions.user_id IS 'User who made/received the transaction';
COMMENT ON COLUMN token_transactions.transaction_type IS 'Type: purchase (revenue), usage (cost), refund, bonus';
COMMENT ON COLUMN token_transactions.tokens IS 'Token amount - positive for additions, negative for usage';
COMMENT ON COLUMN token_transactions.amount_usd IS 'USD amount for purchases (null for usage/bonus)';
COMMENT ON COLUMN token_transactions.description IS 'Human-readable transaction description';
COMMENT ON COLUMN token_transactions.payment_id IS 'External payment processor transaction ID';
COMMENT ON COLUMN token_transactions.stripe_session_id IS 'Stripe checkout session ID for payment tracking';

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Verify table was created
SELECT 'Token transactions table created successfully' as status;

-- Show sample data
SELECT 
    transaction_type,
    COUNT(*) as count,
    SUM(tokens) as total_tokens,
    SUM(amount_usd) as total_amount
FROM token_transactions 
GROUP BY transaction_type
ORDER BY transaction_type;

-- Show recent revenue
SELECT * FROM revenue_summary 
WHERE date >= CURRENT_DATE - INTERVAL '30 days'
LIMIT 10;

-- Show user purchase summary
SELECT * FROM user_purchase_history LIMIT 5;