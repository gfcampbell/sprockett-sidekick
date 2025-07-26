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
          userEmail: data.user!.email || null,
          tokensRemaining: 100,
          subscriptionTier: 'free'
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
          userEmail: data.user!.email || null,
          tokensRemaining: 100,
          subscriptionTier: 'free'
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
        
        // Update global state and fetch token balance
        const { data: userAccount } = await supabase
          .from('user_accounts')
          .select('tokens_remaining, subscription_tier')
          .eq('user_id', user.id)
          .single();
        
        setUserState(prev => ({
          ...prev,
          currentUserId: user.id,
          isAuthenticated: true,
          userEmail: user.email,
          tokensRemaining: userAccount?.tokens_remaining || 0,
          subscriptionTier: userAccount?.subscription_tier || 'free'
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
   * Session update helper - handles user state updates for both initial load and auth changes
   */
  const updateUserSession = useCallback(async (session: any) => {
    if (session) {
      console.log('✅ User session active:', session.user.email);
      
      try {
        // Fetch token balance and update state
        const { data: userAccount } = await supabase
          .from('user_accounts')
          .select('tokens_remaining, subscription_tier')
          .eq('user_id', session.user.id)
          .single();
        
        setUserState(prev => ({
          ...prev,
          currentUserId: session.user.id,
          isAuthenticated: true,
          userEmail: session.user.email || null,
          tokensRemaining: userAccount?.tokens_remaining || 0,
          subscriptionTier: userAccount?.subscription_tier || 'free'
        }));
        
        // Ensure user account exists in database (non-blocking)
        Promise.race([
          ensureUserAccount(session.user.id, session.user.email || ''),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout after 10 seconds')), 10000))
        ]).catch(error => {
          console.error(`❌ Failed to ensure user account (non-blocking):`, {
            error: error.message,
            userEmail: session.user.email,
            userId: session.user.id
          });
        });
        
      } catch (error) {
        console.error('❌ Error updating user session:', error);
      }
    } else {
      console.log('🔐 No user session - clearing state');
      setUserState(prev => ({
        ...prev,
        currentUserId: null,
        isAuthenticated: false,
        userEmail: null,
        tokensRemaining: 0,
        subscriptionTier: 'free'
      }));
    }
  }, [setUserState, ensureUserAccount]);

  /**
   * Sets up auth state change listener - follows official Supabase pattern
   * Checks existing session FIRST, then sets up listener for future changes
   */
  const initializeAuth = useCallback(async () => {
    console.log('🔐 Initializing Supabase Auth system');
    
    if (!supabase) {
      console.error('❌ Supabase client not available');
      return;
    }

    try {
      // STEP 1: Check for existing session FIRST (official Supabase pattern)
      console.log('🔐 Checking for existing session...');
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('❌ Error getting initial session:', sessionError);
      } else {
        if (session) {
          console.log('🔄 Found existing session on initialization:', session.user.email);
        } else {
          console.log('🔄 No existing session found');
        }
        // Update state immediately with existing session (or null)
        await updateUserSession(session);
      }

      // STEP 2: Set up listener for future auth changes
      console.log('🔐 Setting up auth state change listener...');
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('🔐 Auth state change event:', event);
        
        // Handle specific events
        if (event === 'SIGNED_IN') {
          console.log('✅ User signed in:', session?.user.email);
        } else if (event === 'SIGNED_OUT') {
          console.log('👋 User signed out');
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('🔄 Token refreshed for:', session?.user.email);
        } else if (event === 'INITIAL_SESSION') {
          console.log('🔄 Initial session event:', session?.user.email || 'no session');
        }
        
        // Update user state for any auth change
        await updateUserSession(session);
      });
      
      console.log('✅ Auth listener set up successfully');
      
      // Store subscription for potential cleanup
      return subscription;
      
    } catch (error) {
      console.error('❌ Exception during auth initialization:', error);
    }
    
    console.log('✅ Auth initialization complete');
  }, [updateUserSession]);

  /**
   * Fetches current token balance from database
   * @returns Current token balance
   */
  const fetchTokenBalance = useCallback(async (): Promise<number> => {
    if (!userState.currentUserId) {
      return 0;
    }

    try {
      const { data, error } = await supabase
        .from('user_accounts')
        .select('tokens_remaining')
        .eq('user_id', userState.currentUserId)
        .single();

      if (error) {
        console.error('❌ Error fetching token balance:', error);
        return 0;
      }

      const balance = data?.tokens_remaining || 0;
      
      // Update local state
      setUserState(prev => ({
        ...prev,
        tokensRemaining: balance
      }));
      
      return balance;
    } catch (error) {
      console.error('❌ Exception fetching token balance:', error);
      return 0;
    }
  }, [userState.currentUserId, setUserState]);

  /**
   * Updates token balance in database and local state
   * @param newBalance - New token balance
   */
  const updateTokenBalance = useCallback(async (newBalance: number): Promise<void> => {
    if (!userState.currentUserId) {
      console.warn('⚠️ Cannot update tokens: user not authenticated');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_accounts')
        .update({ tokens_remaining: newBalance })
        .eq('user_id', userState.currentUserId);

      if (error) {
        console.error('❌ Error updating token balance:', error);
        return;
      }

      // Update local state
      setUserState(prev => ({
        ...prev,
        tokensRemaining: newBalance
      }));
      
      console.log(`✅ Token balance updated: ${newBalance}`);
    } catch (error) {
      console.error('❌ Exception updating token balance:', error);
    }
  }, [userState.currentUserId, setUserState]);

  return {
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    initializeAuth,
    fetchTokenBalance,
    updateTokenBalance,
    userState
  };
}