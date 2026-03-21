'use client';

import React from 'react';
import Link from 'next/link';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={`flex items-center gap-1.5 text-sm ${className}`}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-slate-400" aria-hidden>/</span>}
          {item.href ? (
            <Link href={item.href} className="text-uff-accent hover:text-uff-accent-hover font-medium">
              {item.label}
            </Link>
          ) : item.onClick ? (
            <button type="button" onClick={item.onClick} className="text-uff-accent hover:text-uff-accent-hover font-medium">
              {item.label}
            </button>
          ) : (
            <span className="text-slate-600">{item.label}</span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
