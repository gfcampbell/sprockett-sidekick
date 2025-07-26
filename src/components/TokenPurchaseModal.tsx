import React, { useState, useEffect } from 'react';

interface TokenPurchaseModalProps {
  onClose: () => void;
  onPurchase?: (tokens: number, price: number) => Promise<void>;
}

interface TokenTier {
  tokens: number;
  pricePerToken: number;
  totalPrice: number;
  savings?: string;
}

const TOKEN_TIERS: TokenTier[] = [
  {
    tokens: 100,
    pricePerToken: 0.15,
    totalPrice: 15.00
  },
  {
    tokens: 500,
    pricePerToken: 0.11,
    totalPrice: 55.00,
    savings: "Save 27%"
  },
  {
    tokens: 1000,
    pricePerToken: 0.07,
    totalPrice: 70.00,
    savings: "Save 53%"
  }
];

export default function TokenPurchaseModal({ onClose, onPurchase }: TokenPurchaseModalProps) {
  const [selectedTier, setSelectedTier] = useState<TokenTier | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

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

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setMessageType(type);
    
    // Clear message after 5 seconds
    setTimeout(() => {
      setMessage('');
    }, 5000);
  };

  const handlePurchase = async () => {
    if (!selectedTier) {
      showMessage('Please select a token package', 'error');
      return;
    }

    setIsProcessing(true);
    
    try {
      if (onPurchase) {
        await onPurchase(selectedTier.tokens, selectedTier.totalPrice);
        showMessage(`Successfully added ${selectedTier.tokens} tokens to your account!`, 'success');
        
        // Close modal after success
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        // For now, show coming soon message
        showMessage('Payment processing coming soon!', 'info');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Purchase failed. Please try again.';
      showMessage(errorMessage, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle modal backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="auth-modal" onClick={handleBackdropClick}>
      <div className="auth-modal-content" style={{ maxWidth: '500px' }}>
        <div className="auth-modal-header">
          <h3>Buy Tokens</h3>
          <button className="auth-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        
        <div className="auth-modal-body">
          <div className="token-tiers">
            {TOKEN_TIERS.map((tier, index) => (
              <div 
                key={index}
                className={`token-tier ${selectedTier === tier ? 'selected' : ''}`}
                onClick={() => setSelectedTier(tier)}
              >
                <div className="token-tier-header">
                  <span className="token-count">{tier.tokens} Tokens</span>
                  {tier.savings && (
                    <span className="savings-badge">{tier.savings}</span>
                  )}
                </div>
                
                <div className="token-tier-pricing">
                  <div className="price-per-token">
                    ${tier.pricePerToken.toFixed(2)} per token
                  </div>
                  <div className="total-price">
                    ${tier.totalPrice.toFixed(2)} total
                  </div>
                </div>
                
                <div className="radio-indicator">
                  <div className={`radio-circle ${selectedTier === tier ? 'checked' : ''}`}>
                    {selectedTier === tier && <div className="radio-dot" />}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selectedTier && (
            <div className="purchase-summary">
              <p>
                You're purchasing <strong>{selectedTier.tokens} tokens</strong> for{' '}
                <strong>${selectedTier.totalPrice.toFixed(2)}</strong>
              </p>
            </div>
          )}

          <button 
            className="auth-btn purchase-btn"
            onClick={handlePurchase}
            disabled={!selectedTier || isProcessing}
          >
            {isProcessing 
              ? 'Processing...' 
              : selectedTier 
                ? `Purchase ${selectedTier.tokens} Tokens - $${selectedTier.totalPrice.toFixed(2)}`
                : 'Select a Package'
            }
          </button>
        </div>

        {/* Messages */}
        {message && (
          <div className={`auth-message ${messageType}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
}