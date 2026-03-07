'use client';

import React, { useState, useRef, useEffect } from 'react';

export interface MultiselectOption {
  _id: string;
  name: string;
  unit?: string;
}

interface MultiselectDropdownProps {
  options: MultiselectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  /** Optional: show unit in option label (e.g. "Stitching (per piece)") */
  showUnit?: boolean;
  /** Optional: translation function for selectAll */
  selectAllLabel?: string;
  searchPlaceholder?: string;
}

export default function MultiselectDropdown({
  options,
  selectedIds,
  onChange,
  placeholder = 'Select...',
  label,
  required,
  disabled,
  showUnit,
  selectAllLabel = 'Select all',
  searchPlaceholder = 'Search...',
}: MultiselectDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = search.trim()
    ? options.filter((o) => o.name.toLowerCase().includes(search.toLowerCase()))
    : options;

  const allSelected = options.length > 0 && selectedIds.length === options.length;
  const filteredSelectedCount = filtered.filter((o) => selectedIds.includes(o._id)).length;
  const filteredAllSelected = filtered.length > 0 && filtered.every((o) => selectedIds.includes(o._id));

  const toggleOption = (id: string) => {
    if (disabled) return;
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  const selectAllFiltered = (checked: boolean) => {
    if (disabled) return;
    const filteredIds = filtered.map((o) => o._id);
    if (checked) {
      const merged = [...new Set([...selectedIds, ...filteredIds])];
      onChange(merged);
    } else {
      onChange(selectedIds.filter((id) => !filteredIds.includes(id)));
    }
  };

  const selectAll = (checked: boolean) => {
    if (disabled) return;
    onChange(checked ? options.map((o) => o._id) : []);
  };

  useEffect(() => {
    if (options.length === 1 && selectedIds.length === 0 && !disabled) {
      onChange([options[0]._id]);
    }
  }, [options, selectedIds.length, disabled, onChange]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayLabel = (o: MultiselectOption) =>
    showUnit && o.unit ? `${o.name} (${o.unit})` : o.name;

  return (
    <div ref={containerRef} className="relative">
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
          {selectedIds.length === 0
            ? placeholder
            : `${selectedIds.length} selected`}
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
          {options.length > 10 && (
            <div className="p-2 border-b border-slate-100">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent"
                autoFocus
              />
            </div>
          )}
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-uff-accent">
              <input
                type="checkbox"
                checked={search.trim() ? filteredAllSelected : allSelected}
                onChange={(e) => (search.trim() ? selectAllFiltered(e.target.checked) : selectAll(e.target.checked))}
                className="rounded"
              />
              {selectAllLabel}
            </label>
          </div>
          <div className="overflow-y-auto flex-1 min-h-0 p-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-slate-500 py-4 text-center">{search.trim() ? 'No matches' : 'No options'}</p>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((o) => (
                  <label
                    key={o._id}
                    className={`flex items-center gap-2 px-2 py-2 rounded cursor-pointer hover:bg-slate-50 ${
                      selectedIds.includes(o._id) ? 'bg-uff-accent/5' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(o._id)}
                      onChange={() => toggleOption(o._id)}
                      className="rounded"
                    />
                    <span className="text-sm text-slate-800 truncate">{displayLabel(o)}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
