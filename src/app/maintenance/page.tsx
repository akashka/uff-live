'use client';

import React from 'react';
import Link from 'next/link';

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-100 p-6">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 p-4 rounded-full bg-amber-100 inline-block">
          <svg className="w-16 h-16 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">System Maintenance</h1>
        <p className="text-slate-600 mb-6">
          We are currently performing scheduled maintenance to improve our services. The system is in read-only mode.
        </p>
        <p className="text-sm text-slate-500 mb-8">
          Please try again in a few minutes. We apologize for any inconvenience.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center px-6 py-3 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-800 transition"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
