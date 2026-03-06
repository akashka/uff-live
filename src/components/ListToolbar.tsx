'use client';

import React from 'react';

interface ListToolbarProps {
  search?: string;
  searchPlaceholder?: string;
  onSearchChange?: (v: string) => void;
  sortBy?: string;
  onSortChange?: (v: string) => void;
  sortOptions?: { value: string; label: string }[];
  viewMode?: 'table' | 'card';
  onViewModeChange?: (v: 'table' | 'card') => void;
  children?: React.ReactNode;
}

export default function ListToolbar({
  search,
  searchPlaceholder = 'Search...',
  onSearchChange,
  sortBy,
  onSortChange,
  sortOptions = [],
  viewMode = 'table',
  onViewModeChange,
  children,
}: ListToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      {onSearchChange && (
        <div className="flex-1 min-w-[160px]">
          <input
            type="text"
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white placeholder-slate-500"
          />
        </div>
      )}
      {sortOptions.length > 0 && onSortChange && (
        <select
          value={sortBy ?? ''}
          onChange={(e) => onSortChange(e.target.value)}
          className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
        >
          {sortOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}
      {onViewModeChange && (
        <div className="flex rounded-lg border border-slate-300 overflow-hidden bg-white">
          <button
            type="button"
            onClick={() => onViewModeChange('table')}
            className={`px-3 py-2 text-sm font-medium ${viewMode === 'table' ? 'bg-uff-accent text-uff-primary' : 'text-slate-600 hover:bg-slate-100'}`}
            title="Table view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('card')}
            className={`px-3 py-2 text-sm font-medium ${viewMode === 'card' ? 'bg-uff-accent text-uff-primary' : 'text-slate-600 hover:bg-slate-100'}`}
            title="Card view"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
            </svg>
          </button>
        </div>
      )}
      {children}
    </div>
  );
}
