'use client';

import React from 'react';
import { useApp } from '@/contexts/AppContext';
import VendorPayments from '@/components/payments/VendorPayments';

export default function VendorPaymentsPage() {
  const { t } = useApp();
  return <VendorPayments />;
}
