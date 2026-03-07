'use client';

import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';

export interface EmployeeDocument {
  type: string;
  name?: string;
  fileUrl: string;
  uploadedAt: string;
}

const DOCUMENT_TYPES = [
  { value: 'aadhaar', labelKey: 'docAadhaar' },
  { value: 'pan', labelKey: 'docPan' },
  { value: 'driving_license', labelKey: 'docDrivingLicense' },
  { value: 'passport', labelKey: 'docPassport' },
  { value: 'voter_id', labelKey: 'docVoterId' },
  { value: 'other', labelKey: 'other' },
] as const;

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '';
  }
}

interface EmployeeDocumentsProps {
  documents: EmployeeDocument[];
  employeeId: string | null;
  canUpload: boolean;
  onUploadSuccess: () => void;
  uploadEndpoint: string;
}

export function EmployeeDocuments({
  documents,
  employeeId,
  canUpload,
  onUploadSuccess,
  uploadEndpoint,
}: EmployeeDocumentsProps) {
  const { t } = useApp();
  const [uploadType, setUploadType] = useState<string>(DOCUMENT_TYPES[0].value);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!uploadFile || !employeeId) return;
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append('file', uploadFile);
      fd.append('type', uploadType);
      const res = await fetch(uploadEndpoint, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setUploadFile(null);
      onUploadSuccess();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {documents.length === 0 ? (
        <p className="text-sm text-slate-500">{t('noDocuments')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {documents.map((doc, i) => (
            <div
              key={i}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-slate-800 capitalize">
                  {DOCUMENT_TYPES.find((d) => d.value === doc.type)?.labelKey ? t(DOCUMENT_TYPES.find((d) => d.value === doc.type)!.labelKey) : doc.type}
                  {doc.name ? ` — ${doc.name}` : ''}
                </p>
                <p className="text-xs text-slate-500">{formatDate(doc.uploadedAt)}</p>
              </div>
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-lg bg-uff-accent px-3 py-1.5 text-sm font-medium text-uff-primary hover:bg-uff-accent-hover"
              >
                {t('view')}
              </a>
            </div>
          ))}
        </div>
      )}

      {canUpload && employeeId && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-4">
          <p className="mb-3 text-sm font-medium text-slate-700">{t('uploadDocument')}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('documentType')}</label>
              <select
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 bg-white"
              >
                {DOCUMENT_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {t(d.labelKey)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('file')}</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                className="block text-sm text-slate-800 file:mr-2 file:rounded-lg file:border-0 file:bg-uff-accent file:px-3 file:py-1.5 file:text-uff-primary file:font-medium"
              />
            </div>
            <button
              onClick={handleUpload}
              disabled={!uploadFile || uploading}
              className="rounded-lg bg-uff-accent px-4 py-2 text-sm font-medium text-uff-primary hover:bg-uff-accent-hover disabled:opacity-50"
            >
              {uploading ? '...' : t('upload')}
            </button>
          </div>
          {uploadError && <p className="mt-2 text-sm text-rose-600">{uploadError}</p>}
          <p className="mt-2 text-xs text-slate-500">JPEG, PNG, WebP, GIF or PDF. Max 5MB. {t('documentsCannotBeDeleted')}</p>
        </div>
      )}
    </div>
  );
}
