// Auth header component - exact replica of deprecated client header auth
import React, { useState } from 'react';
import { useAuth } from '../lib/authContext';
import { useAuthFunctions } from '../lib/useAuth';
import AuthModal from './AuthModal';

export default function AuthHeader() {
  const { userState } = useAuth();
  const { signOut } = useAuthFunctions();
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'signin' | 'signup'>('signin');

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const showSignIn = () => {
    setModalMode('signin');
    setShowModal(true);
  };

  const showSignUp = () => {
    setModalMode('signup');
    setShowModal(true);
  };

  return (
    <>
      {/* Exact same structure as deprecated client */}
      <div className="auth-header">
        {/* Auth Links (shown when not authenticated) */}
        {!userState.isAuthenticated && (
          <div id="auth-links" className="auth-links">
            <a href="#" id="show-signin" className="auth-link" onClick={(e) => { e.preventDefault(); showSignIn(); }}>
              Sign In
            </a>
            <a href="#" id="show-signup" className="auth-link" onClick={(e) => { e.preventDefault(); showSignUp(); }}>
              Sign Up
            </a>
          </div>
        )}

        {/* Auth Status (shown when authenticated) */}
        {userState.isAuthenticated && userState.userEmail && (
          <div id="auth-status" className="auth-status">
            <div className="auth-info">
              <span className="user-email">{userState.userEmail}</span>
              <button id="logout-button" className="logout-btn" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      {showModal && (
        <AuthModal 
          mode={modalMode}
          onClose={() => setShowModal(false)}
          onToggleMode={() => setModalMode(modalMode === 'signin' ? 'signup' : 'signin')}
        />
      )}
    </>
  );
}