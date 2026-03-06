'use client';

import React from 'react';
import Link from 'next/link';

interface ActionButtonsProps {
  onView?: () => void;
  onEdit?: () => void;
  onToggleActive?: () => void;
  onDelete?: () => void;
  passbookHref?: string;
  isActive?: boolean;
  viewLabel?: string;
  editLabel?: string;
  toggleLabel?: string;
  deleteLabel?: string;
  passbookLabel?: string;
}

export default function ActionButtons({
  onView,
  onEdit,
  onToggleActive,
  onDelete,
  passbookHref,
  isActive = true,
  viewLabel = 'View',
  editLabel = 'Edit',
  toggleLabel,
  deleteLabel = 'Delete',
  passbookLabel = 'Passbook',
}: ActionButtonsProps) {
  const defaultToggleLabel = isActive ? 'Make Inactive' : 'Make Active';
  const label = toggleLabel ?? defaultToggleLabel;

  return (
    <div className="flex flex-wrap items-center gap-2 justify-end">
      {onView && (
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium text-sm hover:bg-slate-100 transition"
        >
          {viewLabel}
        </button>
      )}
      {passbookHref && (
        <Link
          href={passbookHref}
          className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium text-sm hover:bg-slate-100 transition"
        >
          {passbookLabel}
        </Link>
      )}
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center px-3 py-1.5 rounded-lg border border-amber-500/60 bg-amber-50 text-amber-800 font-medium text-sm hover:bg-amber-100 transition"
        >
          {editLabel}
        </button>
      )}
      {onToggleActive && (
        <button
          type="button"
          onClick={onToggleActive}
          className={`inline-flex items-center px-3 py-1.5 rounded-lg border font-medium text-sm transition ${
            isActive
              ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
              : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
          }`}
        >
          {label}
        </button>
      )}
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 font-medium text-sm hover:bg-red-100 transition"
        >
          {deleteLabel}
        </button>
      )}
    </div>
  );
}
