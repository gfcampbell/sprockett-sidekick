import { useState, useRef, useEffect } from 'react';
import './UserDropdown.css';

interface UserDropdownProps {
  userEmail: string;
  isAdmin: boolean;
  onSignOut: () => void;
  onNavigateToAdmin: () => void;
  onBuyTokens: () => void;
}

export function UserDropdown({ 
  userEmail, 
  isAdmin, 
  onSignOut, 
  onNavigateToAdmin,
  onBuyTokens 
}: UserDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="user-dropdown" ref={dropdownRef}>
      <button 
        className="user-dropdown-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="user-email">{userEmail}</span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="user-dropdown-menu">
          <div className="dropdown-header">
            {userEmail}
          </div>
          <div className="dropdown-divider"></div>
          <button className="dropdown-item" onClick={() => {
            // TODO: Navigate to account settings
            setIsOpen(false);
          }}>
            Account Settings
          </button>
          {isAdmin && (
            <button className="dropdown-item" onClick={() => {
              onNavigateToAdmin();
              setIsOpen(false);
            }}>
              Admin Dashboard
            </button>
          )}
          <button className="dropdown-item" onClick={() => {
            onBuyTokens();
            setIsOpen(false);
          }}>
            Buy Tokens
          </button>
          <div className="dropdown-divider"></div>
          <button className="dropdown-item sign-out" onClick={() => {
            onSignOut();
            setIsOpen(false);
          }}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}