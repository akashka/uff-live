'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface SelectOption {
  _id: string;
  name: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  label,
  required,
  disabled,
  className = '',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o._id === value);

  const filtered = search.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : options;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-slate-800 mb-1">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        className={`w-full px-3 py-2 border rounded-lg text-left text-sm flex items-center justify-between gap-2 min-h-[42px] ${
          disabled
            ? 'bg-slate-50 cursor-not-allowed text-slate-500'
            : 'bg-white border-slate-300 hover:border-slate-400 focus:ring-2 focus:ring-uff-accent focus:border-uff-accent'
        }`}
      >
        <span className="truncate text-slate-800">
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <svg
          className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg max-h-[280px] flex flex-col">
          <div className="p-2 border-b border-slate-100">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 p-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">No matches</p>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((o) => (
                  <button
                    key={o._id}
                    type="button"
                    onClick={() => handleSelect(o._id)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                      o._id === value
                        ? 'bg-uff-accent text-uff-primary font-medium'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {o.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
