'use client';

import { type ReactNode } from 'react';

interface DataTableProps {
  children: ReactNode;
  /** Enable sticky header when table scrolls vertically */
  stickyHeader?: boolean;
  /** Max height for vertical scroll (e.g. "500px") */
  maxHeight?: string;
  className?: string;
}

/** Polished data table container with responsive horizontal scroll */
export function DataTable({ children, stickyHeader = false, maxHeight, className = '' }: DataTableProps) {
  const scrollClass = maxHeight ? `overflow-x-auto overflow-y-auto` : 'overflow-x-auto';
  const scrollStyle = maxHeight ? { maxHeight } : undefined;
  return (
    <div className={`rounded-xl bg-white border border-slate-200/80 shadow-sm overflow-hidden ${className}`}>
      <div className={scrollClass} style={scrollStyle}>
        <table className="min-w-full border-collapse">{children}</table>
      </div>
    </div>
  );
}

interface HeaderProps {
  children: ReactNode;
  className?: string;
  sticky?: boolean;
}

export function DataTableHeader({ children, className = '', sticky }: HeaderProps) {
  const stickyClass = sticky ? 'sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm shadow-[0_1px_2px_rgba(0,0,0,0.05)]' : '';
  return (
    <thead className={`bg-slate-50/90 border-b border-slate-200 ${stickyClass} ${className}`}>
      {children}
    </thead>
  );
}

interface HeadProps {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function DataTableHead({ children, align = 'left', className = '' }: HeadProps) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-slate-600 ${alignClass} ${className}`}>
      {children}
    </th>
  );
}

interface BodyProps {
  children: ReactNode;
  className?: string;
}

export function DataTableBody({ children, className = '' }: BodyProps) {
  return (
    <tbody className={`divide-y divide-slate-100 bg-white ${className}`}>
      {children}
    </tbody>
  );
}

interface RowProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function DataTableRow({ children, className = '', onClick }: RowProps) {
  return (
    <tr
      className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/80 transition-colors ${className}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      {children}
    </tr>
  );
}

interface CellProps {
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  colSpan?: number;
  title?: string;
}

export function DataTableCell({ children, align = 'left', className = '', colSpan, title }: CellProps) {
  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td colSpan={colSpan} title={title} className={`px-4 py-3 text-sm text-slate-700 ${alignClass} ${className}`}>
      {children}
    </td>
  );
}

interface EmptyProps {
  children: ReactNode;
  colSpan: number;
  className?: string;
}

export function DataTableEmpty({ children, colSpan, className = '' }: EmptyProps) {
  return (
    <tr>
      <td colSpan={colSpan} className={`px-4 py-16 text-center text-slate-500 ${className}`}>
        {children}
      </td>
    </tr>
  );
}

interface FooterProps {
  children: ReactNode;
  className?: string;
}

export function DataTableFooter({ children, className = '' }: FooterProps) {
  return (
    <tfoot className={`bg-slate-100 border-t border-slate-200 font-semibold ${className}`}>
      {children}
    </tfoot>
  );
}
