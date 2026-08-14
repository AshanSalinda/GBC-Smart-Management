import { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({
  isOpen,
  onClose,
  closeOnBackdropClick = true,
  children,
  className = ""
}) {
  // Prevent body scroll when modal is open
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

  // Handle escape key
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (closeOnBackdropClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  // Use createPortal to render at the root of the document to avoid z-index/stacking context issues
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6"
      style={{ height: '100dvh' }} // Use dynamic viewport height to handle mobile nav bars
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={handleBackdropClick}
      />

      {/* Modal Container */}
      <div
        className={`relative flex flex-col bg-[#18181b] border border-[#2a2a2e] rounded-4xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] w-full max-w-sm max-h-[calc(100dvh-2rem)] sm:max-h-[85vh] overflow-hidden ${className}`}
      >
        {/* Scrollable Content Area */}
        <div className="overflow-y-auto p-6 h-full w-full">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
