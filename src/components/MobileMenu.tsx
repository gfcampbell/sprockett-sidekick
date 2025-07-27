import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './MobileMenu.css';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileMenu({ isOpen, onClose, children }: MobileMenuProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="mobile-menu-backdrop" onClick={onClose} />
      <div className="mobile-menu-panel">
        <div className="mobile-menu-header">
          <button className="mobile-menu-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="mobile-menu-content">
          {children}
        </div>
      </div>
    </>,
    document.body
  );
}