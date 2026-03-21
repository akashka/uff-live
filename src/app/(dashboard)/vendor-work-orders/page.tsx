'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Redirect to unified work orders page */
export default function VendorWorkOrdersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/work-orders?type=vendor');
  }, [router]);
  return null;
}
