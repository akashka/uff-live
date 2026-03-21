'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redirect to unified work orders page */
export default function WorkRecordsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/work-orders?type=contractor');
  }, [router]);
  return null;
}
