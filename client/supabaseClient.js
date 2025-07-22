// client/supabaseClient.js
// Supabase client setup for Oblivn WebRTC app
// Handles database connection initialization

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

// Use global supabase from script tag (simple!)
const { createClient } = window.supabase;

// Initialize Supabase client
let supabase = null;

try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.warn('⚠️ Supabase configuration missing - some features will be disabled');
    } else {
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                storage: window.localStorage,
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: false
            }
        });
        console.log('✅ Supabase client initialized successfully');
    }
} catch (error) {
    console.error('❌ Failed to initialize Supabase client:', error);
}

// Export the initialized client
export { supabase }; 