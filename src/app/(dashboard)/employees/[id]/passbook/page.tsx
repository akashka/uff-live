'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import UserAvatar from '@/components/UserAvatar';
import { PageLoader } from '@/components/Skeleton';
import { formatDate, formatDateRange } from '@/lib/utils';

interface WorkRecord {
  _id: string;
  branch: { name: string } | string;
  periodStart: string;
  periodEnd: string;
  workItems: { rateName: string; quantity: number; amount: number }[];
  otAmount?: number;
  totalAmount: number;
}

interface PaymentRecord {
  _id: string;
  paymentType: string;
  periodStart: string;
  periodEnd: string;
  totalPayable: number;
  paymentAmount: number;
  paymentMode: string;
  transactionRef: string;
  isAdvance: boolean;
  paidAt: string;
}

type PassbookEntry =
  | { type: 'work'; id: string; date: string; particulars: string; credit: number; debit: 0 }
  | { type: 'payment'; id: string; date: string; particulars: string; credit: 0; debit: number };

export default function EmployeePassbookPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const params = useParams();
  const employeeId = params?.id as string | undefined;

  const [employee, setEmployee] = useState<{ _id: string; name: string; photo?: string; employeeType: string } | null>(null);
  const [entries, setEntries] = useState<PassbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const canAccessAny = ['admin', 'finance', 'hr'].includes(user?.role || '');
  const isOwnProfile = user?.employeeId === employeeId;
  const canView = canAccessAny || isOwnProfile;

  useEffect(() => {
    if (!employeeId || !canView) {
      setError(t('accessDenied'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/employees/${employeeId}`).then((r) => r.json()),
      fetch(`/api/work-records?employeeId=${employeeId}`).then((r) => r.json()),
      fetch(`/api/payments?employeeId=${employeeId}`).then((r) => r.json()),
    ])
      .then(([empData, workData, payData]) => {
        if (empData.error || !empData._id) {
          setError(empData.error || t('noData'));
          return;
        }
        setEmployee(empData);

        const workRecords: WorkRecord[] = Array.isArray(workData) ? workData : [];
        const payments: PaymentRecord[] = Array.isArray(payData) ? payData : [];

        const workEntries: PassbookEntry[] = workRecords.map((r) => {
          const branchName = typeof r.branch === 'object' && r.branch?.name ? r.branch.name : String(r.branch || '');
          const period = formatDateRange(r.periodStart, r.periodEnd);
          return {
            type: 'work',
            id: `w-${r._id}`,
            date: r.periodEnd || r.periodStart || '',
            particulars: `${t('workRecord')} – ${branchName} (${period})`,
            credit: r.totalAmount ?? 0,
            debit: 0,
          };
        });

        const paymentEntries: PassbookEntry[] = payments.map((p) => {
          const mode = p.paymentMode || '';
          const ref = p.transactionRef ? ` – ${p.transactionRef}` : '';
          const advanceLabel = p.isAdvance ? ` (${t('advance')})` : '';
          const period = `${p.periodStart?.slice(0, 10) || ''} – ${p.periodEnd?.slice(0, 10) || ''}`;
          return {
            type: 'payment',
            id: `p-${p._id}`,
            date: p.paidAt || '',
            particulars: `${t('payment')} – ${mode}${ref}${advanceLabel} (${period})`,
            credit: 0,
            debit: p.paymentAmount ?? 0,
          };
        });

        const merged: PassbookEntry[] = [...workEntries, ...paymentEntries].sort((a, b) => {
          const da = new Date(a.date).getTime();
          const db = new Date(b.date).getTime();
          return da - db; // oldest first (passbook style)
        });

        setEntries(merged);
      })
      .catch(() => setError(t('error')))
      .finally(() => setLoading(false));
  }, [employeeId, canView, t]);

  if (loading) {
    return (
      <div>
        <PageHeader title={t('passbook')} />
        <PageLoader mode="table" />
      </div>
    );
  }

  if (error || !employee) {
    const backHref = isOwnProfile ? '/profile' : '/employees';
    const backLabel = isOwnProfile ? t('profile') : t('backToEmployees');
    return (
      <div>
        <PageHeader title={t('passbook')} />
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center">
          <p className="text-slate-600">{error || t('noData')}</p>
          <Link href={backHref} className="mt-4 inline-block text-uff-accent hover:underline">
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  let runningBalance = 0;
  const rowsWithBalance = entries.map((e) => {
    runningBalance += e.credit - e.debit;
    return { ...e, balance: runningBalance };
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={isOwnProfile ? '/profile' : '/employees'}
            className="shrink-0 p-2 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center gap-2"
            aria-label={isOwnProfile ? t('profile') : t('backToEmployees')}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline text-slate-700">{isOwnProfile ? t('profile') : t('backToEmployees')}</span>
          </Link>
          <PageHeader title={t('passbook')} />
        </div>
      </div>

      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <UserAvatar photo={employee.photo} name={employee.name} size="lg" className="w-14 h-14 shrink-0" />
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{employee.name}</h2>
              <p className="text-sm text-slate-600">
                {employee.employeeType === 'contractor' ? t('contractor') : t('fullTime')}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-800">{t('date')}</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-800">{t('particulars')}</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{t('credit')}</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{t('debit')}</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-slate-800">{t('balance')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rowsWithBalance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-600">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                rowsWithBalance.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                      {row.date ? formatDate(row.date) : '–'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-800 max-w-xs truncate" title={row.particulars}>
                      {row.particulars}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {row.credit > 0 ? (
                        <span className="text-green-700 font-medium">₹{row.credit.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {row.debit > 0 ? (
                        <span className="text-red-700 font-medium">₹{row.debit.toLocaleString()}</span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium text-slate-800">
                      ₹{row.balance.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {rowsWithBalance.length > 0 && (
          <div className="px-4 py-3 bg-slate-100 border-t border-slate-200 flex justify-end">
            <span className="text-sm font-semibold text-slate-800">
              {t('outstanding')}: ₹{rowsWithBalance[rowsWithBalance.length - 1]?.balance.toLocaleString() ?? 0}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
