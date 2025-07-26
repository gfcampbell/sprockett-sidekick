// Auth modal component - exact replica of deprecated client modal
import React, { useState, useEffect } from 'react';
import { useAuthFunctions } from '../lib/useAuth';

interface AuthModalProps {
  mode: 'signin' | 'signup';
  onClose: () => void;
  onToggleMode: () => void;
}

export default function AuthModal({ mode, onClose, onToggleMode }: AuthModalProps) {
  const { signIn, signUp } = useAuthFunctions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  // Clear form when mode changes
  useEffect(() => {
    setEmail('');
    setPassword('');
    setMessage('');
  }, [mode]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const showAuthMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setMessageType(type);
    
    // Clear message after 5 seconds
    setTimeout(() => {
      setMessage('');
    }, 5000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      showAuthMessage('Please fill in all fields', 'error');
      return;
    }
    
    setIsLoading(true);
    
    try {
      let success = false;
      
      if (mode === 'signup') {
        success = await signUp(email, password);
        if (success) {
          showAuthMessage('Account created successfully! You are now logged in.', 'success');
        }
      } else {
        success = await signIn(email, password);
        if (success) {
          showAuthMessage(`Welcome back, ${email}!`, 'success');
        }
      }
      
      if (success) {
        // Delay modal close to show success message
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed. Please try again.';
      showAuthMessage(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle modal backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    // Exact same structure as deprecated client
    <div id="auth-modal" className="auth-modal" onClick={handleBackdropClick}>
      <div className="auth-modal-content">
        <div className="auth-modal-header">
          <h3 id="auth-modal-title">{mode === 'signup' ? 'Sign Up' : 'Sign In'}</h3>
          <button id="auth-modal-close" className="auth-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="auth-modal-body">
          <form id="auth-form" className="auth-form" onSubmit={handleSubmit}>
            <input 
              type="email" 
              id="auth-email" 
              placeholder="Email" 
              className="auth-input" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
              autoFocus
            />
            <input 
              type="password" 
              id="auth-password" 
              placeholder="Password" 
              className="auth-input" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
            <button 
              type="submit" 
              id="auth-submit-btn" 
              className="auth-btn"
              disabled={isLoading}
            >
              {isLoading 
                ? (mode === 'signin' ? 'Signing In...' : 'Signing Up...') 
                : (mode === 'signin' ? 'Sign In' : 'Sign Up')
              }
            </button>
          </form>
          <div className="auth-toggle">
            <span id="auth-toggle-text">
              {mode === 'signup' ? 'Already have an account?' : "Don't have an account?"}
            </span>
            <a href="#" id="auth-toggle-link" onClick={(e) => { e.preventDefault(); onToggleMode(); }}>
              {mode === 'signup' ? 'Sign In' : 'Sign Up'}
            </a>
          </div>
        </div>
        {/* Auth Messages */}
        {message && (
          <div id="auth-message" className={`auth-message ${messageType}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}