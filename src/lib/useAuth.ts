// Authentication hook with exact functions from deprecated client auth.js
import { useCallback } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './authContext';

export function useAuthFunctions() {
  const { userState, setUserState } = useAuth();

  /**
   * Validates email and password inputs
   * @param email - Email to validate
   * @param password - Password to validate
   * @returns True if valid
   */
  const validateEmailPassword = useCallback((email: string, password: string): boolean => {
    if (!email || !email.includes('@')) {
      throw new Error('Please enter a valid email address');
    }

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    return true;
  }, []);

  /**
   * Ensures user account exists in database with starting token balance
   * @param userId - User ID from Supabase auth
   * @param email - User email from Supabase auth
   */
  const ensureUserAccount = useCallback(async (userId: string, email: string) => {
    const startTime = Date.now();
    console.log(`🔐 [${new Date().toISOString()}] Starting ensureUserAccount for: ${email}`);
    
    try {
      console.log(`🔐 [${new Date().toISOString()}] About to call supabase.from('user_accounts').upsert...`);
      
      // Use upsert to create account if doesn't exist, or update email if changed
      const { data, error } = await supabase
        .from('user_accounts')
        .upsert({
          user_id: userId,
          email: email,
          tokens_remaining: 100, // Default starting balance for new users
          subscription_tier: 'free'
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false // Update email if it changed
        })
        .select();

      const duration = Date.now() - startTime;
      console.log(`🔐 [${new Date().toISOString()}] Database operation completed in ${duration}ms`);

      if (error) {
        console.error(`❌ [${new Date().toISOString()}] Database error after ${duration}ms:`, {
          error: error,
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }

      console.log(`✅ [${new Date().toISOString()}] User account ensured successfully in ${duration}ms:`, data);
      return data;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [${new Date().toISOString()}] Exception in ensureUserAccount after ${duration}ms:`, error);
      throw error;
    }
  }, []);

  /**
   * Signs up a new user with email and password
   * @param email - User's email address
   * @param password - User's password
   * @returns Success status
   */
  const signUp = useCallback(async (email: string, password: string): Promise<boolean> => {
    console.log('🔐 Creating new account for:', email);
    
    try {
      validateEmailPassword(email, password);
    } catch (error) {
      throw error;
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          emailRedirectTo: window.location.origin
        }
      });

      if (error) {
        console.error('❌ Signup error:', error);
        throw new Error(`Signup failed: ${error.message}`);
      }

      if (data.user) {
        console.log('✅ Account created successfully');
        
        // Update user state immediately
        setUserState(prev => ({
          ...prev,
          currentUserId: data.user!.id,
          isAuthenticated: true,
          userEmail: data.user!.email || null
        }));
        
        // Create user account in database
        await ensureUserAccount(data.user!.id, data.user!.email || '');
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ Unexpected signup error:', error);
      throw error;
    }
  }, [validateEmailPassword, ensureUserAccount, setUserState]);

  /**
   * Signs in an existing user with email and password
   * @param email - User's email address
   * @param password - User's password
   * @returns Success status
   */
  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    console.log('🔐 Signing in user:', email);
    
    try {
      validateEmailPassword(email, password);
    } catch (error) {
      throw error;
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        console.error('❌ Login error:', error);
        console.error('❌ Full error object:', JSON.stringify(error, null, 2));
        throw new Error(`Login failed: ${error.message}`);
      }

      if (data.user) {
        console.log('✅ User signed in successfully');
        
        // Update user state immediately
        setUserState(prev => ({
          ...prev,
          currentUserId: data.user!.id,
          isAuthenticated: true,
          userEmail: data.user!.email || null
        }));
        
        // Verify session is stored immediately after sign-in
        setTimeout(async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            console.log('✅ Session verified stored:', session.user.email);
          } else {
            console.error('❌ Session NOT stored after sign-in!');
          }
        }, 100);
        
        return true;
      }

      return false;

    } catch (error) {
      console.error('❌ Unexpected login error:', error);
      throw error;
    }
  }, [validateEmailPassword, setUserState]);

  /**
   * Signs out the current user
   * @returns Success status
   */
  const signOut = useCallback(async (): Promise<boolean> => {
    console.log('🔐 Signing out user');
    
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('❌ Logout error:', error);
        throw new Error(`Logout failed: ${error.message}`);
      }

      // Clear user state
      setUserState(prev => ({
        ...prev,
        currentUserId: null,
        isAuthenticated: false,
        userEmail: null
      }));

      console.log('✅ User signed out successfully');
      return true;

    } catch (error) {
      console.error('❌ Unexpected logout error:', error);
      throw error;
    }
  }, [setUserState]);

  /**
   * Gets current user and updates global state
   * Automatically creates user_accounts row if needed
   * @returns User object or null
   */
  const getCurrentUser = useCallback(async () => {
    console.log('🔐 Checking current user session');
    console.log('🔐 Supabase client available:', !!supabase);
    
    if (!supabase) {
      console.error('❌ Supabase client not initialized');
      return null;
    }

    try {
      console.log('🔐 About to call supabase.auth.getUser()...');
      
      // Add timeout to catch hanging network calls
      const getUserWithTimeout = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('supabase.auth.getUser() timed out after 5 seconds'));
        }, 5000);
        
        supabase.auth.getUser().then(result => {
          clearTimeout(timeout);
          resolve(result);
        }).catch(err => {
          clearTimeout(timeout);
          reject(err);
        });
      });
      
      const { data: { user }, error } = await getUserWithTimeout as any;
      console.log('🔐 supabase.auth.getUser() completed');
      
      if (error) {
        console.error('❌ Get user error:', error);
        setUserState(prev => ({
          ...prev,
          currentUserId: null,
          isAuthenticated: false,
          userEmail: null
        }));
        return null;
      }

      if (user) {
        console.log('✅ User authenticated:', user.email);
        
        // Update global state
        setUserState(prev => ({
          ...prev,
          currentUserId: user.id,
          isAuthenticated: true,
          userEmail: user.email
        }));

        // Auto-create user_accounts row with starting tokens
        await ensureUserAccount(user.id, user.email || '');
        
        return user;
      } else {
        console.log('ℹ️ No authenticated user');
        setUserState(prev => ({
          ...prev,
          currentUserId: null,
          isAuthenticated: false,
          userEmail: null
        }));
        return null;
      }

    } catch (error) {
      console.error('❌ Unexpected error checking user:', error);
      setUserState(prev => ({
        ...prev,
        currentUserId: null,
        isAuthenticated: false,
        userEmail: null
      }));
      return null;
    }
  }, [setUserState, ensureUserAccount]);

  /**
   * Sets up auth state change listener
   * Automatically updates user state when auth changes
   */
  const initializeAuth = useCallback(async () => {
    console.log('🔐 Initializing Supabase Auth system');
    
    if (!supabase) {
      console.error('❌ Supabase client not available');
      return;
    }

    // Simple auth state listener - handles everything
    try {
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('🔐 Auth event:', event);
        
        if (session) {
          console.log('✅ User session active:', session.user.email);
          setUserState(prev => ({
            ...prev,
            currentUserId: session.user.id,
            isAuthenticated: true,
            userEmail: session.user.email || null
          }));
          
          // Ensure user account exists in database
          try {
            console.log(`🔐 [${new Date().toISOString()}] Starting background ensureUserAccount for: ${session.user.email}`);
            
            // Don't await - let it run in background with timeout
            Promise.race([
              ensureUserAccount(session.user.id, session.user.email || ''),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout after 10 seconds')), 10000))
            ]).catch(error => {
              console.error(`❌ [${new Date().toISOString()}] Failed to ensure user account (non-blocking):`, {
                error: error,
                message: error.message,
                userEmail: session.user.email,
                userId: session.user.id
              });
            });
          } catch (error) {
            console.error(`❌ [${new Date().toISOString()}] Failed to ensure user account:`, error);
          }
        } else {
          console.log('🔐 No user session');
          setUserState(prev => ({
            ...prev,
            currentUserId: null,
            isAuthenticated: false,
            userEmail: null
          }));
        }
      });
      console.log('🔐 Auth listener set up successfully');
    } catch (error) {
      console.error('❌ Error setting up auth listener:', error);
    }
    
    // Get initial session using proper Supabase method
    console.log('🔐 About to check for existing session...');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('❌ Error getting session:', error);
      } else if (session) {
        console.log('🔄 Initial session check - found:', session.user.email);
        // Auth listener will handle the rest
      } else {
        console.log('🔄 Initial session check - no session');
      }
    } catch (error) {
      console.error('❌ Exception during session check:', error);
    }
    
    console.log('✅ Auth initialized');
  }, [setUserState, ensureUserAccount]);

  return {
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    initializeAuth,
    userState
  };
}