// client/auth.js
// Supabase Auth integration for Sprockett.ai WebRTC calling app
// ✨ Sprint 3.9: Email/Password Authentication (No more magic links!)
// Handles user authentication, session management, and account auto-creation

import { supabase } from './supabaseClient.js';
import { userState, SUPABASE_URL } from './config.js';

// =============================================
// EMAIL/PASSWORD AUTHENTICATION FUNCTIONS
// =============================================

/**
 * Signs up a new user with email and password
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Promise<boolean>} Success status
 */
export const signUp = async (email, password) => {
    console.log('🔐 Creating new account for:', email);
    
    if (!validateEmailPassword(email, password)) {
        return false;
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
            showAuthMessage(`Signup failed: ${error.message}`, 'error');
            return false;
        }

        if (data.user) {
            console.log('✅ Account created successfully');
            showAuthMessage('Account created successfully! You are now logged in.', 'success');
            
            // Update user state immediately
            userState.currentUserId = data.user.id;
            userState.isAuthenticated = true;
            userState.userEmail = data.user.email;
            
            // Create user account in database
            await ensureUserAccount(data.user.id, data.user.email);
            updateAuthUI();
            return true;
        }

        return false;

    } catch (error) {
        console.error('❌ Unexpected signup error:', error);
        showAuthMessage('Signup failed. Please try again.', 'error');
        return false;
    }
};

/**
 * Signs in an existing user with email and password
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Promise<boolean>} Success status
 */
export const signIn = async (email, password) => {
    console.log('🔐 Signing in user:', email);
    
    if (!validateEmailPassword(email, password)) {
        return false;
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (error) {
            console.error('❌ Login error:', error);
            console.error('❌ Full error object:', JSON.stringify(error, null, 2));
            showAuthMessage(`Login failed: ${error.message}`, 'error');
            return false;
        }

        if (data.user) {
            console.log('✅ User signed in successfully');
            showAuthMessage(`Welcome back, ${data.user.email}!`, 'success');
            
            // Update user state immediately
            userState.currentUserId = data.user.id;
            userState.isAuthenticated = true;
            userState.userEmail = data.user.email;
            
            // Verify session is stored immediately after sign-in
            setTimeout(async () => {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    console.log('✅ Session verified stored:', session.user.email);
                } else {
                    console.error('❌ Session NOT stored after sign-in!');
                }
            }, 100);
            
            // Let the auth state listener handle updateAuthUI and ensureUserAccount
            // Just return true to close the modal
            return true;
        }

        return false;

    } catch (error) {
        console.error('❌ Unexpected login error:', error);
        showAuthMessage('Login failed. Please try again.', 'error');
        return false;
    }
};

/**
 * Signs out the current user
 * @returns {Promise<boolean>} Success status
 */
export const signOut = async () => {
    console.log('🔐 Signing out user');
    
    try {
        const { error } = await supabase.auth.signOut();
        
        if (error) {
            console.error('❌ Logout error:', error);
            showAuthMessage(`Logout failed: ${error.message}`, 'error');
            return false;
        }

        // Clear user state
        userState.currentUserId = null;
        userState.isAuthenticated = false;
        userState.userEmail = null;

        console.log('✅ User signed out successfully');
        showAuthMessage('Signed out successfully', 'success');
        updateAuthUI();
        return true;

    } catch (error) {
        console.error('❌ Unexpected logout error:', error);
        showAuthMessage('Logout failed. Please try again.', 'error');
        return false;
    }
};

/**
 * Gets current user and updates global state
 * Automatically creates user_accounts row if needed
 * @returns {Promise<Object|null>} User object or null
 */
export const getCurrentUser = async () => {
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
        
        const { data: { user }, error } = await getUserWithTimeout;
        console.log('🔐 supabase.auth.getUser() completed');
        
        if (error) {
            console.error('❌ Get user error:', error);
            userState.currentUserId = null;
            userState.isAuthenticated = false;
            userState.userEmail = null;
            updateAuthUI();
            return null;
        }

        if (user) {
            console.log('✅ User authenticated:', user.email);
            
            // Update global state
            userState.currentUserId = user.id;
            userState.isAuthenticated = true;
            userState.userEmail = user.email;

            // Auto-create user_accounts row with starting tokens
            await ensureUserAccount(user.id, user.email);
            
            updateAuthUI();
            return user;
        } else {
            console.log('ℹ️ No authenticated user');
            userState.currentUserId = null;
            userState.isAuthenticated = false;
            userState.userEmail = null;
            updateAuthUI();
            return null;
        }

    } catch (error) {
        console.error('❌ Unexpected error checking user:', error);
        userState.currentUserId = null;
        userState.isAuthenticated = false;
        userState.userEmail = null;
        updateAuthUI();
        return null;
    }
};

// =============================================
// VALIDATION HELPERS
// =============================================

/**
 * Validates email and password inputs
 * @param {string} email - Email to validate
 * @param {string} password - Password to validate
 * @returns {boolean} True if valid
 */
const validateEmailPassword = (email, password) => {
    if (!email || !email.includes('@')) {
        showAuthMessage('Please enter a valid email address', 'error');
        return false;
    }

    if (!password || password.length < 6) {
        showAuthMessage('Password must be at least 6 characters long', 'error');
        return false;
    }

    return true;
};

// =============================================
// USER ACCOUNT MANAGEMENT - SIMPLIFIED
// =============================================

/**
 * Ensures user account exists in database with starting token balance
 * @param {string} userId - User ID from Supabase auth
 * @param {string} email - User email from Supabase auth
 */
const ensureUserAccount = async (userId, email) => {
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
        console.error(`❌ [${new Date().toISOString()}] Exception in ensureUserAccount after ${duration}ms:`, {
            error: error,
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        throw error;
    }
};

// =============================================
// AUTH STATE MONITORING
// =============================================

/**
 * Sets up auth state change listener
 * Automatically updates user state when auth changes
 */
export const initializeAuth = async () => {
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
                userState.currentUserId = session.user.id;
                userState.isAuthenticated = true;
                userState.userEmail = session.user.email;
                
                // Ensure user account exists in database
                try {
                    console.log(`🔐 [${new Date().toISOString()}] Starting background ensureUserAccount for: ${session.user.email}`);
                    
                    // Don't await - let it run in background with timeout
                    Promise.race([
                        ensureUserAccount(session.user.id, session.user.email),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout after 10 seconds')), 10000))
                    ]).catch(error => {
                        console.error(`❌ [${new Date().toISOString()}] Failed to ensure user account (non-blocking):`, {
                            error: error,
                            message: error.message,
                            stack: error.stack,
                            name: error.name,
                            userEmail: session.user.email,
                            userId: session.user.id
                        });
                    });
                } catch (error) {
                    console.error(`❌ [${new Date().toISOString()}] Failed to ensure user account:`, {
                        error: error,
                        message: error.message,
                        stack: error.stack,
                        name: error.name
                    });
                }
            } else {
                console.log('🔐 No user session');
                userState.currentUserId = null;
                userState.isAuthenticated = false;
                userState.userEmail = null;
            }
            
            updateAuthUI();
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
};

// =============================================
// UI MANAGEMENT
// =============================================

/**
 * Updates authentication UI based on current state
 */
const updateAuthUI = () => {
    const authLinks = document.getElementById('auth-links');
    const authStatus = document.getElementById('auth-status');
    
    if (!authLinks || !authStatus) {
        console.log('ℹ️ Auth UI elements not found - retrying in 100ms');
        setTimeout(updateAuthUI, 100);
        return;
    }

    if (userState.isAuthenticated && userState.userEmail) {
        // User is logged in - hide links, show status
        authLinks.style.display = 'none';
        authStatus.style.display = 'flex';
        
        // Update the auth info content
        authStatus.innerHTML = `
            <div class="auth-info">
                <span class="user-email">${userState.userEmail}</span>
                <button id="logout-button" class="logout-btn">Sign Out</button>
            </div>
        `;
        
        // Add logout event listener to the new button
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', async (e) => {
                e.preventDefault();
                await signOut();
            });
        }
    } else {
        // User is not logged in - show links, hide status
        authLinks.style.display = 'flex';
        authStatus.style.display = 'none';
    }
};

/**
 * Shows authentication messages to user
 * @param {string} message - Message to display
 * @param {string} type - Message type: 'success', 'error', 'info'
 */
const showAuthMessage = (message, type = 'info') => {
    console.log(`🔐 ${type.toUpperCase()}: ${message}`);
    
    const authMessage = document.getElementById('auth-message');
    if (authMessage) {
        authMessage.textContent = message;
        authMessage.className = `auth-message ${type}`;
        
        // Clear message after 5 seconds
        setTimeout(() => {
            authMessage.textContent = '';
            authMessage.className = 'auth-message';
        }, 5000);
    }
};

// =============================================
// MODAL MANAGEMENT
// =============================================

/**
 * Shows the authentication modal
 * @param {string} mode - 'signin' or 'signup'
 */
const showAuthModal = (mode = 'signin') => {
    const modal = document.getElementById('auth-modal');
    const title = document.getElementById('auth-modal-title');
    const submitBtn = document.getElementById('auth-submit-btn');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleLink = document.getElementById('auth-toggle-link');
    
    if (!modal) return;
    
    // Clear any previous messages
    const authMessage = document.getElementById('auth-message');
    if (authMessage) {
        authMessage.textContent = '';
        authMessage.className = 'auth-message';
    }
    
    // Clear form
    const emailInput = document.getElementById('auth-email');
    const passwordInput = document.getElementById('auth-password');
    if (emailInput) emailInput.value = '';
    if (passwordInput) passwordInput.value = '';
    
    // Configure modal for the specified mode
    if (mode === 'signup') {
        title.textContent = 'Sign Up';
        submitBtn.textContent = 'Sign Up';
        toggleText.textContent = 'Already have an account?';
        toggleLink.textContent = 'Sign In';
        modal.setAttribute('data-mode', 'signup');
    } else {
        title.textContent = 'Sign In';
        submitBtn.textContent = 'Sign In';
        toggleText.textContent = "Don't have an account?";
        toggleLink.textContent = 'Sign Up';
        modal.setAttribute('data-mode', 'signin');
    }
    
    // Show modal
    modal.style.display = 'flex';
    
    // Focus on email input
    setTimeout(() => {
        if (emailInput) emailInput.focus();
    }, 100);
};

/**
 * Hides the authentication modal
 */
const hideAuthModal = () => {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

/**
 * Toggles between signin and signup modes
 */
const toggleAuthMode = () => {
    const modal = document.getElementById('auth-modal');
    const currentMode = modal?.getAttribute('data-mode') || 'signin';
    const newMode = currentMode === 'signin' ? 'signup' : 'signin';
    showAuthModal(newMode);
};

// =============================================
// UI EVENT HANDLERS (will be called from main.js)
// =============================================

/**
 * Sets up auth form event listeners
 * Call this after DOM is loaded
 */
export const setupAuthUI = () => {
    // Modal trigger buttons
    const showSignInBtn = document.getElementById('show-signin');
    const showSignUpBtn = document.getElementById('show-signup');
    const authModalClose = document.getElementById('auth-modal-close');
    const authModal = document.getElementById('auth-modal');
    const authForm = document.getElementById('auth-form');
    const authToggleLink = document.getElementById('auth-toggle-link');

    // Show sign in modal
    if (showSignInBtn) {
        showSignInBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showAuthModal('signin');
        });
    }

    // Show sign up modal
    if (showSignUpBtn) {
        showSignUpBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showAuthModal('signup');
        });
    }

    // Close modal
    if (authModalClose) {
        authModalClose.addEventListener('click', hideAuthModal);
    }

    // Close modal when clicking outside
    if (authModal) {
        authModal.addEventListener('click', (e) => {
            if (e.target === authModal) {
                hideAuthModal();
            }
        });
    }

    // Toggle between signin and signup
    if (authToggleLink) {
        authToggleLink.addEventListener('click', (e) => {
            e.preventDefault();
            toggleAuthMode();
        });
    }

    // Handle form submission
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const emailInput = document.getElementById('auth-email');
            const passwordInput = document.getElementById('auth-password');
            const submitBtn = document.getElementById('auth-submit-btn');
            
            if (!emailInput || !passwordInput) return;
            
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const modal = document.getElementById('auth-modal');
            const mode = modal?.getAttribute('data-mode') || 'signin';
            
            if (!email || !password) {
                showAuthMessage('Please fill in all fields', 'error');
                return;
            }
            
            // Disable submit button during processing
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = mode === 'signin' ? 'Signing In...' : 'Signing Up...';
            }
            
            try {
                let success = false;
                
                if (mode === 'signup') {
                    success = await signUp(email, password);
                } else {
                    success = await signIn(email, password);
                }
                
                if (success) {
                    // Delay modal close to show success message
                    setTimeout(() => {
                        hideAuthModal();
                    }, 1500);
                }
            } finally {
                // Re-enable submit button
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = mode === 'signin' ? 'Sign In' : 'Sign Up';
                }
            }
        });
    }

    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const modal = document.getElementById('auth-modal');
            if (modal && modal.style.display === 'flex') {
                hideAuthModal();
            }
        }
    });

    console.log('✅ Modal-based auth UI event listeners set up');
};

// Export modal management functions for external use if needed
export { showAuthModal, hideAuthModal, toggleAuthMode }; 