'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redirect to Reports page - analytics is now merged into Reports */
export default function StyleOrderAnalyticsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/reports?tab=analytics');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <p className="text-slate-600">Redirecting to Reports...</p>
    </div>
  );
}
