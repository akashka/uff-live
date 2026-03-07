'use client';

import React from 'react';
import { useApp } from '@/contexts/AppContext';
import PaymentsByType from '@/components/payments/PaymentsByType';

export default function ContractorsPaymentsPage() {
  const { t } = useApp();
  return <PaymentsByType paymentType="contractor" pageTitle={`${t('payments')} — ${t('contractors')}`} />;
}
