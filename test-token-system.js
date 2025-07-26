// Quick test script to verify token system integration
// Run this with: node test-token-system.js

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testTokenSystem() {
  console.log('🧪 Testing token system...');
  
  try {
    // 1. Check user accounts table
    const { data: users, error: usersError } = await supabase
      .from('user_accounts')
      .select('user_id, tokens_remaining, subscription_tier')
      .limit(3);
    
    if (usersError) {
      console.error('❌ Error fetching users:', usersError);
      return;
    }
    
    console.log('✅ Sample user accounts:');
    users.forEach(user => {
      console.log(`  - ${user.user_id}: ${user.tokens_remaining} tokens (${user.subscription_tier})`);
    });
    
    // 2. Check token usage table
    const { data: usage, error: usageError } = await supabase
      .from('token_usage')
      .select('user_id, tokens_used, mode, duration_seconds, timestamp')
      .order('timestamp', { ascending: false })
      .limit(5);
    
    if (usageError) {
      console.error('❌ Error fetching usage:', usageError);
      return;
    }
    
    console.log('\n✅ Recent token usage:');
    usage.forEach(record => {
      console.log(`  - ${record.tokens_used} tokens, ${record.mode} mode, ${record.duration_seconds}s`);
    });
    
    // 3. Check call sessions table
    const { data: sessions, error: sessionsError } = await supabase
      .from('call_sessions')
      .select('id, user_id, mode, start_time, end_time, credit_cost')
      .order('start_time', { ascending: false })
      .limit(3);
    
    if (sessionsError) {
      console.error('❌ Error fetching sessions:', sessionsError);
      return;
    }
    
    console.log('\n✅ Recent sessions:');
    sessions.forEach(session => {
      const duration = session.end_time ? 
        new Date(session.end_time) - new Date(session.start_time) : 
        'ongoing';
      console.log(`  - ${session.mode} session, cost: $${session.credit_cost}`);
    });
    
    console.log('\n🎉 Token system is properly connected to database!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTokenSystem();