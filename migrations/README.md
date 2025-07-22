# Oblivion Database Migrations

This folder contains SQL migration files for setting up the Supabase database schema for the Oblivion embed system.

## 📁 Migration Files

- **`001_create_call_sessions_table.sql`** - Initial schema setup for call tracking and billing
- **`002_*.sql`** - User presence system fixes and constraints
- **`003_create_token_billing_tables.sql`** - 🆕 **Sprint 2: Token billing tables (user_accounts, token_usage)**

## 🚀 How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste the contents of each migration file in order:
   - `001_create_call_sessions_table.sql`
   - `003_create_token_billing_tables.sql` ⚡ **New for Sprint 2**
5. Click **Run** to execute each migration

### Option 2: Supabase CLI
```bash
# Install Supabase CLI if you haven't
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Apply migrations
supabase db push
```

### Option 3: psql Command Line
```bash
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f migrations/001_create_call_sessions_table.sql
psql "postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres" -f migrations/003_create_token_billing_tables.sql
```

## 📊 What Gets Created

### Tables
- **`call_sessions`** - Main table for tracking embedded calls
- **`user_presence`** - Real-time presence tracking
- **`user_accounts`** - 🆕 **User token balances and subscription tiers**
- **`token_usage`** - 🆕 **Log of all token consumption events**

### Indexes
- Performance indexes on room_id, start_time, used_turn, user_id
- Composite billing index for cost analysis
- **🆕 Token billing indexes** for user_id, timestamp, mode queries

### Views
- **`active_calls`** - Shows currently active calls
- **`daily_billing_summary`** - Aggregated billing data by day
- **`user_token_summary`** - 🆕 **User balances with usage statistics**
- **`daily_token_usage`** - 🆕 **Daily token consumption breakdown**

### Security
- Row Level Security (RLS) enabled
- Open policies for now (no auth required)
- Ready for future Supabase authentication integration

## 🔍 Verifying Installation

After running the migrations, verify with these queries:

```sql
-- Check tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' AND table_name IN ('call_sessions', 'user_presence', 'user_accounts', 'token_usage');

-- Check views exist
SELECT table_name FROM information_schema.views 
WHERE table_schema = 'public' AND table_name IN ('active_calls', 'daily_billing_summary', 'user_token_summary', 'daily_token_usage');

-- Test demo user setup
SELECT user_id, tokens_remaining, subscription_tier FROM user_accounts WHERE user_id = 'demo_user';

-- Test insert (optional)
INSERT INTO call_sessions (room_id, mode) VALUES ('test-123', 'video');
SELECT * FROM call_sessions WHERE room_id = 'test-123';
```

## 🪙 Sprint 2: Token Billing System

### Token Rates (Per Minute)
| Mode | No TURN | With TURN |
|------|---------|-----------|
| Voice | 1 token | 2 tokens |
| Video | 2 tokens | 6 tokens |

### Demo Users Created
- **`demo_user`** - 500 tokens (free tier)
- **`test_user_1`** - 100 tokens (free tier)  
- **`test_user_2`** - 250 tokens (pro tier)
- **`developer`** - 1000 tokens (enterprise tier)

### Key Features
- ✅ **Real-time token burning** during calls
- ✅ **Detailed usage logging** for transparency
- ✅ **Fail-safe design** - calls continue even if billing fails
- ✅ **Ready for Supabase auth** when implemented

## 📈 Usage Examples

```sql
-- View active calls
SELECT * FROM active_calls;

-- Check billing summary
SELECT * FROM daily_billing_summary;

-- View user token balances
SELECT * FROM user_token_summary;

-- Check token usage today
SELECT * FROM daily_token_usage WHERE usage_date = CURRENT_DATE;

-- Find TURN usage
SELECT room_id, start_time, credit_cost 
FROM call_sessions 
WHERE used_turn = true;

-- Calculate total tokens used today
SELECT SUM(tokens_used) as total_tokens 
FROM token_usage 
WHERE DATE(timestamp) = CURRENT_DATE;

-- Check specific user balance
SELECT user_id, tokens_remaining 
FROM user_accounts 
WHERE user_id = 'demo_user';
```

## 🔄 Future Migrations

When adding new migrations:
1. Name them sequentially: `004_add_feature.sql`, `005_update_schema.sql`, etc.
2. Always use `IF NOT EXISTS` for idempotent operations
3. Document the changes in this README
4. Test on a staging environment first 