// Auth header component - exact replica of deprecated client header auth
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../lib/authContext';
import { useAuthFunctions } from '../lib/useAuth';
import AuthModal from './AuthModal';
import TokenPurchaseModal from './TokenPurchaseModal';
import { UserDropdown } from './UserDropdown';

interface AuthHeaderProps {
  onNavigateToAdmin?: () => void;
}

export default function AuthHeader({ onNavigateToAdmin }: AuthHeaderProps) {
  const { userState, isAdmin } = useAuth();
  const { updateTokenBalance, fetchTokenBalance, signOut } = useAuthFunctions();
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'signin' | 'signup'>('signin');
  const [showTokenPurchase, setShowTokenPurchase] = useState(false);


  const showSignIn = () => {
    setModalMode('signin');
    setShowModal(true);
  };

  const showSignUp = () => {
    setModalMode('signup');
    setShowModal(true);
  };

  const handleTokenPurchase = async (tokens: number, price: number) => {
    try {
      // For beta testing - just add tokens directly to account
      const newBalance = userState.tokensRemaining + tokens;
      await updateTokenBalance(newBalance);
      
      // Refresh the token balance in UI
      await fetchTokenBalance();
      
      console.log(`✅ Beta purchase: Added ${tokens} tokens for $${price} (new balance: ${newBalance})`);
    } catch (error) {
      console.error('Token purchase failed:', error);
      throw error;
    }
  };

  return (
    <>
      {/* Exact same structure as deprecated client */}
      <div className="auth-header">
        {/* Auth Links (shown when not authenticated) */}
        {!userState.isAuthenticated && (
          <div id="auth-links" className="auth-links">
            <a href="/landing/about" className="auth-link">About</a>
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
              <span className="token-balance">
                <span className="token-icon">●</span> {userState.tokensRemaining}
              </span>
              {userState.tokensRemaining < 30 && (
                <button 
                  className="buy-tokens-btn low-tokens"
                  onClick={() => setShowTokenPurchase(true)}
                  title="Buy more tokens"
                >
                  Buy Tokens
                </button>
              )}
              <UserDropdown
                userEmail={userState.userEmail}
                isAdmin={isAdmin()}
                onSignOut={signOut}
                onNavigateToAdmin={onNavigateToAdmin || (() => {})}
                onBuyTokens={() => setShowTokenPurchase(true)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Auth Modal - Render at document body level using portal */}
      {showModal && createPortal(
        <AuthModal 
          mode={modalMode}
          onClose={() => setShowModal(false)}
          onToggleMode={() => setModalMode(modalMode === 'signin' ? 'signup' : 'signin')}
        />,
        document.body
      )}

      {/* Token Purchase Modal */}
      {showTokenPurchase && createPortal(
        <TokenPurchaseModal 
          onClose={() => setShowTokenPurchase(false)}
          onPurchase={handleTokenPurchase}
        />,
        document.body
      )}
    </>
  );
}