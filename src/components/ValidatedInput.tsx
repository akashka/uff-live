'use client';

import React from 'react';
import { validateField, type FieldType, FIELD_PLACEHOLDERS } from '@/lib/fieldValidation';

export interface ValidatedInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: string;
  onChange: (value: string) => void;
  fieldType?: FieldType;
  placeholderHint?: string;
  /** Custom validate fn; overrides fieldType if provided */
  validate?: (value: string) => boolean;
  /** Use for dark/glass backgrounds (e.g. login) */
  variant?: 'default' | 'dark';
}

export default function ValidatedInput({
  value,
  onChange,
  fieldType = 'text',
  placeholderHint,
  validate,
  variant = 'default',
  className = '',
  readOnly,
  ...rest
}: ValidatedInputProps) {
  const isValid = validate
    ? (v: string) => v.trim() === '' || validate(v)
    : (v: string) => validateField(fieldType, v);

  const state =
    value.trim() === '' ? 'neutral' : isValid(value) ? 'valid' : 'invalid';

  const placeholder = placeholderHint ?? FIELD_PLACEHOLDERS[fieldType];

  const borderClass =
    state === 'valid'
      ? variant === 'dark'
        ? 'border-green-400 ring-1 ring-green-400/30'
        : 'border-green-500 ring-1 ring-green-500/30'
      : state === 'invalid'
        ? variant === 'dark'
          ? 'border-red-400 ring-1 ring-red-400/30'
          : 'border-red-500 ring-1 ring-red-500/30'
        : variant === 'dark'
          ? 'border-white/20'
          : 'border-slate-300';

  const baseClass = 'w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2';
  const focusRing = readOnly ? '' : 'focus:ring-uff-accent focus:ring-offset-0';
  const bgClass =
    variant === 'dark'
      ? 'bg-white/10 text-white placeholder-slate-300'
      : readOnly
        ? 'bg-slate-50 cursor-default text-slate-800'
        : 'text-slate-900';
  const effectiveBorder = readOnly
    ? variant === 'dark'
      ? 'border-white/20'
      : 'border-slate-300'
    : borderClass;

  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      readOnly={readOnly}
      placeholder={placeholder}
      className={`${baseClass} border ${effectiveBorder} ${bgClass} ${focusRing} ${className}`}
    />
  );
}
