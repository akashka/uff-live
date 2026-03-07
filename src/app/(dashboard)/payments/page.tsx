'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function PaymentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  useEffect(() => {
    if (user?.employeeType === 'full_time') {
      router.replace('/payments/full-time');
    } else {
      router.replace('/payments/contractors');
    }
  }, [router, user?.employeeType]);
  return null;
}
