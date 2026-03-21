'use client';

import React from 'react';
import Modal from '@/components/Modal';
import { useApp } from '@/contexts/AppContext';

export interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Step 1: Download template - shown first */
  onDownloadTemplate: () => void;
  downloadLabel?: string;
  /** Instructions shown to user */
  instructions?: React.ReactNode;
  /** Step 2: File input and import */
  accept?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onImport: () => void;
  importing?: boolean;
  importLabel?: string;
  /** Optional: import mode radio (e.g. add vs replace) */
  importModeSection?: React.ReactNode;
  /** Disable import when conditions not met */
  canImport?: boolean;
}

export default function ImportModal({
  open,
  onClose,
  title,
  onDownloadTemplate,
  downloadLabel = 'Download Template',
  instructions,
  accept = '.xls,.xlsx',
  file,
  onFileChange,
  onImport,
  importing = false,
  importLabel = 'Import',
  importModeSection,
  canImport = true,
}: ImportModalProps) {
  const { t } = useApp();
  const handleClose = () => {
    onFileChange(null);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size="md"
      footer={
        <div className="flex gap-3 justify-end">
          <button
            onClick={onImport}
            disabled={importing || !file || !canImport}
            className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {importing ? '...' : importLabel}
          </button>
          <button
            onClick={handleClose}
            className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition"
          >
            {t('cancel')}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Step 1: Download Template - FIRST and prominent */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Step 1: Download Template</h3>
          <p className="text-sm text-slate-600 mb-3">
            Download the Excel template with pre-filled dropdown options and validation. Fill in your data and upload it back.
          </p>
          <button
            type="button"
            onClick={onDownloadTemplate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-uff-accent bg-uff-accent/10 text-uff-accent hover:bg-uff-accent/20 font-medium text-sm transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloadLabel}
          </button>
        </div>

        {instructions && (
          <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-3 border border-slate-200">
            {instructions}
          </div>
        )}

        {/* Step 2: Upload */}
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2">Step 2: Upload Filled Template</h3>
          <input
            type="file"
            accept={accept}
            onChange={(e) => onFileChange(e.target.files?.[0] || null)}
            className="w-full text-sm py-2"
          />
        </div>

        {importModeSection}
      </div>
    </Modal>
  );
}
