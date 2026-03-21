'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function FullTimePaymentsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/payments');
  }, [router]);
  return null;
}
