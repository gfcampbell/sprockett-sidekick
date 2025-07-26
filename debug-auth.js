#!/usr/bin/env node

// Debug script to check Supabase auth.users table for gerry@ampd.fm
// Uses service role key to query the auth schema directly

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
    process.exit(1);
}

// Initialize Supabase client with service role key for admin access
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function debugAuthUser() {
    console.log('🔍 Debugging authentication for gerry@ampd.fm...\n');

    try {
        // Query 1: Check if user exists in auth.users
        console.log('1. Querying auth.users table for gerry@ampd.fm...');
        const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
        
        if (usersError) {
            console.error('❌ Error querying users:', usersError);
            return;
        }

        const targetUser = users.users.find(user => user.email === 'gerry@ampd.fm');
        
        if (!targetUser) {
            console.log('❌ User gerry@ampd.fm not found in auth.users table');
            console.log('📊 Total users in database:', users.users.length);
            console.log('📧 Existing user emails:', users.users.map(u => u.email).slice(0, 5));
            return;
        }

        console.log('✅ User found in auth.users table');
        console.log('📋 User details:');
        console.log(`   ID: ${targetUser.id}`);
        console.log(`   Email: ${targetUser.email}`);
        console.log(`   Email confirmed: ${targetUser.email_confirmed_at ? 'YES' : 'NO'}`);
        console.log(`   Email confirmed at: ${targetUser.email_confirmed_at || 'Not confirmed'}`);
        console.log(`   Confirmed at: ${targetUser.confirmed_at || 'Not confirmed'}`);
        console.log(`   Created at: ${targetUser.created_at}`);
        console.log(`   Updated at: ${targetUser.updated_at}`);
        console.log(`   Last sign in: ${targetUser.last_sign_in_at || 'Never'}`);
        console.log(`   Banned until: ${targetUser.banned_until || 'Not banned'}`);
        console.log(`   Phone confirmed: ${targetUser.phone_confirmed_at ? 'YES' : 'NO'}`);
        console.log(`   Recovery sent at: ${targetUser.recovery_sent_at || 'Never'}`);
        console.log(`   Invite sent at: ${targetUser.invited_at || 'Never'}`);
        console.log(`   Action link: ${targetUser.action_link || 'None'}`);

        // Check if encrypted_password exists
        console.log(`   Has encrypted password: ${targetUser.encrypted_password ? 'YES' : 'NO'}`);
        if (targetUser.encrypted_password) {
            console.log(`   Password hash length: ${targetUser.encrypted_password.length} characters`);
        }

        // Query 2: Check other users for comparison
        console.log('\n2. Checking other users for comparison...');
        const confirmedUsers = users.users.filter(user => user.email_confirmed_at);
        console.log(`📊 Users with confirmed emails: ${confirmedUsers.length}/${users.users.length}`);
        
        const usersWithPasswords = users.users.filter(user => user.encrypted_password);
        console.log(`📊 Users with encrypted passwords: ${usersWithPasswords.length}/${users.users.length}`);

        // Query 3: Check for recent successful logins
        const recentLogins = users.users.filter(user => user.last_sign_in_at).sort((a, b) => 
            new Date(b.last_sign_in_at) - new Date(a.last_sign_in_at)
        ).slice(0, 3);
        
        console.log('\n3. Recent successful logins:');
        if (recentLogins.length > 0) {
            recentLogins.forEach((user, index) => {
                console.log(`   ${index + 1}. ${user.email} - ${user.last_sign_in_at}`);
            });
        } else {
            console.log('   No users have successfully logged in yet');
        }

        // Query 4: Test sign in with a different approach (admin)
        console.log('\n4. Testing authentication methods...');
        
        // Try to get user by email using admin API
        try {
            const { data: userByEmail, error: emailError } = await supabase.auth.admin.getUserById(targetUser.id);
            if (emailError) {
                console.log(`❌ Error getting user by ID: ${emailError.message}`);
            } else {
                console.log(`✅ Successfully retrieved user by ID via admin API`);
            }
        } catch (error) {
            console.log(`❌ Exception getting user by ID: ${error.message}`);
        }

        // Query 5: Check user metadata
        console.log('\n5. User metadata:');
        console.log(`   App metadata:`, JSON.stringify(targetUser.app_metadata, null, 2));
        console.log(`   User metadata:`, JSON.stringify(targetUser.user_metadata, null, 2));

        // Final analysis
        console.log('\n📋 DIAGNOSIS:');
        
        if (!targetUser.email_confirmed_at) {
            console.log('❌ ISSUE: Email not confirmed');
        } else {
            console.log('✅ Email is confirmed');
        }
        
        if (!targetUser.encrypted_password) {
            console.log('❌ ISSUE: No encrypted password set');
        } else {
            console.log('✅ Encrypted password exists');
        }
        
        if (targetUser.banned_until) {
            console.log(`❌ ISSUE: User is banned until ${targetUser.banned_until}`);
        } else {
            console.log('✅ User is not banned');
        }

        // Test actual sign in
        console.log('\n6. Testing actual sign-in (this may fail, which is expected)...');
        try {
            // Note: We can't test the actual password since we don't know it
            console.log('⚠️ Cannot test actual sign-in without the user\'s password');
            console.log('   Suggestion: Have user try password reset flow');
        } catch (error) {
            console.log(`❌ Sign-in test failed: ${error.message}`);
        }

    } catch (error) {
        console.error('❌ Fatal error during debugging:', error);
    }
}

// Run the debug function
debugAuthUser().then(() => {
    console.log('\n🔍 Debug completed');
    process.exit(0);
}).catch((error) => {
    console.error('❌ Debug script failed:', error);
    process.exit(1);
});