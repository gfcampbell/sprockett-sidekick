🎯 Sprockett Sidekick - Admin Interface Development Handoff

  Current System State (Production Ready)

  ✅ Fully Functional Features

  - Authentication System: Persistent login, user management,
  email confirmation
  - Per-Minute Token Billing: 1 token/minute, real-time UI
  countdown, database reconciliation
  - AI Coaching: GPT-4 coaching suggestions every 15 seconds
  during sessions
  - Session Management: Complete session tracking with proper
  UUID handling
  - Database: Clean schema with proper constraints, indexes, and
  RLS policies

  🚀 Production Metrics

  - Users: 11+ active accounts with token balances (92-1000
  tokens)
  - Sessions: Active session logging with billing data
  - Database: All tables operational with real data
  - Deployment: Live at sprockett.app (Vercel + Supabase)

  Admin Interface Requirements Analysis

  Core Admin Functions Needed

  1. User Management

  -- Admin needs to see/manage these user operations
  SELECT user_id, email, tokens_remaining, subscription_tier,
  created_at
  FROM user_accounts ORDER BY created_at DESC;

  -- Add tokens to user accounts
  UPDATE user_accounts SET tokens_remaining = tokens_remaining +
  X WHERE user_id = ?;

  -- Change subscription tiers
  UPDATE user_accounts SET subscription_tier = 'pro' WHERE
  user_id = ?;

  2. Session Analytics

  -- View all coaching sessions with billing data
  SELECT s.id, s.user_id, u.email, s.start_time, s.end_time,
         s.mode, s.credit_cost, tu.tokens_used
  FROM call_sessions s
  JOIN user_accounts u ON s.user_id = u.user_id
  LEFT JOIN token_usage tu ON s.id = tu.session_id
  ORDER BY s.start_time DESC;

  3. Financial Dashboard

  -- Revenue tracking, token usage patterns, billing analytics
  SELECT DATE(timestamp) as date,
         SUM(tokens_used) as tokens_consumed,
         COUNT(DISTINCT user_id) as active_users
  FROM token_usage
  GROUP BY DATE(timestamp)
  ORDER BY date DESC;

  4. System Health Monitoring

  - Active sessions count
  - Error rate tracking
  - API usage metrics
  - Database performance

  Recommended Admin Interface Architecture

  Option A: Dedicated Admin App (Recommended)

  /admin-dashboard
  ├── /src
  │   ├── /components
  │   │   ├── UserManagement.tsx
  │   │   ├── SessionAnalytics.tsx
  │   │   ├── FinancialDashboard.tsx
  │   │   └── SystemHealth.tsx
  │   ├── /lib
  │   │   ├── adminAuth.ts          # Admin-only authentication
  │   │   ├── adminQueries.ts       # Database queries for admin
  data
  │   │   └── supabaseAdmin.ts      # Service role client
  │   └── App.tsx
  ├── /api
  │   ├── admin-users.js            # User management endpoints
  │   ├── admin-analytics.js        # Analytics endpoints
  │   └── admin-billing.js          # Financial data endpoints

  Option B: Admin Section in Main App (Simpler)

  // Add to existing app with role-based access
  if (userState.role === 'admin') {
    // Show admin interface
  }

  Database Admin Setup Required

  1. Admin Role System

  -- Add admin role to user_accounts
  ALTER TABLE user_accounts ADD COLUMN role TEXT DEFAULT 'user'
  CHECK (role IN ('user', 'admin', 'super_admin'));

  -- Set yourself as admin
  UPDATE user_accounts SET role = 'super_admin'
  WHERE email = 'your-email@domain.com';

  2. Admin-Specific Views (Already Created)

  -- Available in 000_clean_schema.sql:
  user_token_summary       -- User overview with token usage
  daily_billing_summary    -- Financial analytics  
  daily_token_usage        -- Usage patterns
  active_calls            -- Real-time session monitoring

  3. Admin API Permissions

  -- Create admin-only RLS policies
  CREATE POLICY "Allow admin full access" ON user_accounts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_accounts
      WHERE user_id = auth.uid()::TEXT
      AND role IN ('admin', 'super_admin')
    )
  );

  Technical Implementation Approach

  Phase 1: Admin Authentication (2-3 hours)

  1. Add role column to user_accounts table
  2. Set your admin role in database
  3. Create admin auth middleware - check role on protected
  routes
  4. Admin login flow - redirect to admin dashboard after auth

  Phase 2: Core Admin Views (1 day)

  1. User Management Table - view/edit user accounts, add tokens
  2. Session Analytics - real-time and historical session data
  3. Financial Dashboard - revenue, usage trends, billing metrics
  4. Basic system monitoring - active users, session counts

  Phase 3: Advanced Features (2-3 days)

  1. Bulk user operations - mass token grants, subscription
  changes
  2. Advanced analytics - cohort analysis, retention metrics
  3. System configuration - pricing changes, feature flags
  4. Audit logging - track all admin actions

  Key Database Queries for Admin Interface

  User Management Queries

  -- Get all users with usage stats
  SELECT
    ua.user_id, ua.email, ua.tokens_remaining,
  ua.subscription_tier,
    COUNT(cs.id) as total_sessions,
    COALESCE(SUM(tu.tokens_used), 0) as tokens_consumed,
    ua.created_at
  FROM user_accounts ua
  LEFT JOIN call_sessions cs ON ua.user_id = cs.user_id
  LEFT JOIN token_usage tu ON ua.user_id = tu.user_id
  GROUP BY ua.user_id, ua.email, ua.tokens_remaining,
  ua.subscription_tier, ua.created_at
  ORDER BY ua.created_at DESC;

  -- Add tokens to user
  UPDATE user_accounts
  SET tokens_remaining = tokens_remaining + $1,
      updated_at = NOW()
  WHERE user_id = $2;

  Analytics Queries

  -- Daily revenue and usage
  SELECT
    DATE(tu.timestamp) as date,
    COUNT(DISTINCT tu.user_id) as active_users,
    COUNT(*) as total_sessions,
    SUM(tu.tokens_used) as tokens_consumed,
    SUM(tu.tokens_used * 0.10) as estimated_revenue  -- $0.10 per
   token
  FROM token_usage tu
  WHERE tu.timestamp >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY DATE(tu.timestamp)
  ORDER BY date DESC;

  -- Top users by usage
  SELECT
    ua.email,
    SUM(tu.tokens_used) as total_tokens,
    COUNT(DISTINCT DATE(tu.timestamp)) as active_days,
    MAX(tu.timestamp) as last_active
  FROM user_accounts ua
  JOIN token_usage tu ON ua.user_id = tu.user_id
  WHERE tu.timestamp >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY ua.user_id, ua.email
  ORDER BY total_tokens DESC
  LIMIT 10;

  System Health Queries

  -- Active sessions right now
  SELECT COUNT(*) as active_sessions
  FROM call_sessions
  WHERE end_time IS NULL;

  -- Error rate (sessions without proper end_time)
  SELECT
    COUNT(*) FILTER (WHERE end_time IS NULL) as
  incomplete_sessions,
    COUNT(*) as total_sessions,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE end_time IS NULL) /
  COUNT(*),
      2
    ) as error_rate_percent
  FROM call_sessions
  WHERE start_time >= CURRENT_DATE - INTERVAL '7 days';

  Security Considerations

  Admin Access Control

  // Middleware for admin routes
  export async function requireAdmin(req: Request) {
    const user = await getUser(req);
    if (!user || user.role !== 'admin') {
      throw new Error('Admin access required');
    }
    return user;
  }

  // Use service role for admin operations
  const adminSupabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  Audit Logging

  -- Track admin actions
  CREATE TABLE admin_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    target_user_id TEXT,
    details JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  Recommended Development Approach

  Quick Start (Same Day)

  1. Set your admin role in database manually
  2. Add admin check to existing app
  3. Create basic admin page with user list
  4. Test admin access control

  Production Ready (1 Week)

  1. Dedicated admin interface with proper design
  2. Complete user management - view, edit, add tokens
  3. Analytics dashboard with charts and metrics
  4. Security audit - proper access controls and logging

  Files You'll Need to Create

  Database Changes

  - migrations/004_add_admin_roles.sql - Add role column and
  admin policies
  - Update existing RLS policies for admin access

  Admin Interface

  - /admin/ directory with React admin app
  - Admin-specific API endpoints
  - Admin authentication middleware
  - Analytics and reporting components

  Configuration

  - Environment variables for admin features
  - Admin role seeding script
  - Deployment configuration for admin routes

  Current System Integration Points

  Auth System

  - ✅ Ready: Existing auth context can be extended for admin
  roles
  - ✅ Supabase Integration: User management already working

  Database

  - ✅ Ready: All tables exist with proper structure
  - ✅ Analytics Views: Already created in clean schema
  - ✅ Performance: Proper indexes for admin queries

  API Structure

  - ✅ Ready: Existing API pattern can be extended for admin
  endpoints
  - ✅ Service Role: Already configured for admin operations

  This handoff gives you everything needed to build a
  comprehensive admin interface on top of your solid,
  production-ready foundation. The system is ready for admin
  functionality - it just needs the interface layer built on top.