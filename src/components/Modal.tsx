'use client';

import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
};

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title?: string;
  size?: ModalSize;
  /** If true, clicking backdrop closes modal. Default true when onClose provided. */
  closeOnBackdrop?: boolean;
  /** If true, Escape key closes modal. Default true when onClose provided. */
  closeOnEscape?: boolean;
  children: React.ReactNode;
  /** Optional footer content (e.g. action buttons). Rendered sticky at bottom. */
  footer?: React.ReactNode;
  /** Optional: hide the X close button in header */
  hideCloseButton?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  size = 'lg',
  closeOnBackdrop = !!onClose,
  closeOnEscape = !!onClose,
  children,
  footer,
  hideCloseButton = false,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape && onClose) {
        onClose();
      }
    },
    [closeOnEscape, onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [open, handleEscape]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/50 backdrop-blur-sm"
          onClick={closeOnBackdrop && onClose ? () => onClose() : undefined}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className={`relative bg-white rounded-2xl shadow-2xl w-full ${sizeClasses[size]} my-8 flex flex-col max-h-[calc(100vh-4rem)]`}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
        {(title || (onClose && !hideCloseButton)) && (
          <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 shrink-0">
            {title && (
              <h2 id="modal-title" className="text-xl font-semibold text-slate-900">
                {title}
              </h2>
            )}
            {onClose && !hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                className="ml-auto p-2 -m-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">{children}</div>

        {footer && (
          <div className="shrink-0 px-6 py-4 border-t border-slate-200 bg-slate-50/80 rounded-b-2xl">
            {footer}
          </div>
        )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
