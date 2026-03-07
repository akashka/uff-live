'use client';

import React from 'react';

export type ConfirmVariant = 'danger' | 'warning' | 'neutral';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

const variantStyles: Record<ConfirmVariant, string> = {
  danger: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100',
  warning: 'border-amber-500/60 bg-amber-50 text-amber-800 hover:bg-amber-100',
  neutral: 'border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200',
};

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'warning',
  onConfirm,
  onCancel,
  loading: externalLoading = false,
}: ConfirmModalProps) {
  const [internalLoading, setInternalLoading] = React.useState(false);
  const loading = externalLoading || internalLoading;

  const handleConfirm = async () => {
    setInternalLoading(true);
    try {
      await onConfirm();
      onCancel();
    } catch {
      // Keep modal open on error so user can retry or cancel
    } finally {
      setInternalLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[60]" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
        {title && (
          <h2 id="confirm-title" className="text-lg font-semibold text-slate-800 mb-2">
            {title}
          </h2>
        )}
        <p className="text-slate-600 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg border font-medium disabled:opacity-50 ${variantStyles[variant]}`}
          >
            {loading ? '...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
