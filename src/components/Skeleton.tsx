'use client';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circle' | 'rect' | 'card';
}

export function Skeleton({ className = '', variant = 'rect' }: SkeletonProps) {
  const base = 'animate-pulse bg-slate-200 rounded';
  const variants = {
    text: 'h-4',
    circle: 'rounded-full aspect-square',
    rect: 'h-8',
    card: 'h-24 rounded-xl',
  };
  return <div className={`${base} ${variants[variant]} ${className}`} />;
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3 text-left">
                  <Skeleton className="h-4 w-20" variant="text" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: cols }).map((_, j) => (
                  <td key={j} className="px-4 py-3">
                    <Skeleton className={j === cols - 1 ? 'h-8 w-16 ml-auto' : 'h-4'} variant="text" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
          <Skeleton className="h-5 w-3/4 mb-2" variant="text" />
          <Skeleton className="h-3 w-full mb-1" variant="text" />
          <Skeleton className="h-3 w-2/3 mb-3" variant="text" />
          <Skeleton className="h-6 w-16 mt-2" variant="rect" />
        </div>
      ))}
    </div>
  );
}

export function PageLoader({ mode = 'table' }: { mode?: 'table' | 'card' }) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Skeleton className="h-10 w-64" variant="rect" />
        <Skeleton className="h-10 w-32" variant="rect" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 w-48" variant="rect" />
        <Skeleton className="h-9 w-24" variant="rect" />
      </div>
      {mode === 'table' ? <TableSkeleton rows={8} cols={5} /> : <CardGridSkeleton count={6} />}
    </div>
  );
}

export function Spinner({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <div className={`animate-spin rounded-full border-4 border-uff-accent border-t-transparent ${className}`} />
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex justify-between">
        <Skeleton className="h-8 w-64" variant="text" />
        <Skeleton className="h-10 w-32" variant="rect" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm">
            <Skeleton className="h-4 w-24 mb-2" variant="text" />
            <Skeleton className="h-8 w-20" variant="rect" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-64 rounded-xl" variant="card" />
        <Skeleton className="h-64 rounded-xl" variant="card" />
      </div>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton variant="circle" className="w-20 h-20" />
        <div className="flex-1">
          <Skeleton className="h-6 w-48 mb-2" variant="text" />
          <Skeleton className="h-4 w-32" variant="text" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="h-3 w-24 mb-1" variant="text" />
            <Skeleton className="h-4 w-full" variant="text" />
          </div>
        ))}
      </div>
    </div>
  );
}
