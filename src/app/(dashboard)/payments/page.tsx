'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/payments/contractors');
  }, [router]);
  return null;
}
