'use client';

import React from 'react';
import { Spinner } from '@/components/Skeleton';

interface SaveOverlayProps {
  /** When true, shows the overlay */
  show: boolean;
  /** Optional label (default: "Saving...") */
  label?: string;
}

/** Full-screen overlay with spinner shown during save operations. Blocks interaction. */
export default function SaveOverlay({ show, label = 'Saving...' }: SaveOverlayProps) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm"
      role="alert"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white px-8 py-6 shadow-xl">
        <Spinner className="w-12 h-12" />
        <p className="text-slate-700 font-medium">{label}</p>
      </div>
    </div>
  );
}
