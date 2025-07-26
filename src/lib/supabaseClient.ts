// Supabase client setup for React app
// Uses exact same configuration as deprecated client

import { createClient } from '@supabase/supabase-js';

// Exact same credentials from deprecated client
const SUPABASE_URL = 'https://yfiinxqzzakcvyihujyf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlmaWlueHF6emFrY3Z5aWh1anlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg5NzUxNTgsImV4cCI6MjA2NDU1MTE1OH0.WKkhhhmx5j1FFEfM8lbQ-XUK_Pyluatcs9XfifP4_eM';

// Initialize Supabase client with exact same configuration
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

console.log('✅ Supabase client initialized successfully');