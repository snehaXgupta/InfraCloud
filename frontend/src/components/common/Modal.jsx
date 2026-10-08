import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const Modal = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-2xl',
}) => {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overflow-x-hidden flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Content */}
      <div
        className={`relative w-full ${maxWidth} rounded-2xl bg-white dark:bg-[#11141c] border border-slate-200 dark:border-[#262c3e] shadow-2xl z-10 overflow-hidden transform transition-all animate-in fade-in duration-200`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-[#1c202c]">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#191d2a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 md:p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
