import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import './MobileMenu.css';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileMenu({ isOpen, onClose, children }: MobileMenuProps) {
  useEffect(() => {
    const menuRootId = 'mobile-menu-root';
    let menuRoot = document.getElementById(menuRootId);
    if (!menuRoot) {
      menuRoot = document.createElement('div');
      menuRoot.id = menuRootId;
      document.body.appendChild(menuRoot);
    }
    if (isOpen) {
      document.body.classList.add('menu_open');
    } else {
      document.body.classList.remove('menu_open');
    }
    return () => {
      document.body.classList.remove('menu_open');
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const menuRoot = document.getElementById('mobile-menu-root');

  return menuRoot ? createPortal(
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
    menuRoot
  ) : null;
}