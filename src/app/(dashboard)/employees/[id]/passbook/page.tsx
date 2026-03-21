'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import Breadcrumb from '@/components/Breadcrumb';
import UserAvatar from '@/components/UserAvatar';
import { PageLoader } from '@/components/Skeleton';
import { formatDate, formatAmount } from '@/lib/utils';
import { toast } from '@/lib/toast';

type PassbookEntry = { type: string; id: string; date: string; particulars: string; credit: number; debit: number; balance?: number };

export default function EmployeePassbookPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const params = useParams();
  const employeeId = params?.id as string | undefined;

  const [employee, setEmployee] = useState<{ _id: string; name: string; photo?: string; employeeType: string } | null>(null);
  const [entries, setEntries] = useState<PassbookEntry[]>([]);
  const [outstanding, setOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const canAccessAny = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '');
  const isOwnProfile = user?.employeeId === employeeId;
  const canView = canAccessAny || isOwnProfile;

  useEffect(() => {
    setPage(1);
  }, [employeeId]);

  useEffect(() => {
    if (!employeeId || !canView) {
      setError(t('accessDenied'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/employees/${employeeId}/passbook?page=${page}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setEmployee(data.employee);
        setEntries((prev) => (page === 1 ? data.data : [...prev, ...data.data]));
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setOutstanding(data.outstanding ?? 0);
      })
      .catch(() => {
        const errMsg = t('error');
        setError(errMsg);
        toast.error(errMsg);
      })
      .finally(() => setLoading(false));
  }, [employeeId, canView, page, t]);

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

  const rowsWithBalance = entries;

  const backHref = isOwnProfile ? '/profile' : '/employees';

  return (
    <div>
      <PageHeader title={t('passbook')}>
        {rowsWithBalance.length > 0 && (
          <div className="flex gap-2">
            <a
              href={`/api/employees/${employeeId}/passbook?format=excel`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {t('export')} Excel
            </a>
            <a
              href={`/api/reports/payslip/${employeeId}?month=${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              {t('payslip')}
            </a>
          </div>
        )}
      </PageHeader>
      <div className="mb-4 -mt-2">
        <Breadcrumb
          items={[
            { label: isOwnProfile ? t('profile') : t('employees'), href: backHref },
            { label: employee?.name || t('passbook') },
          ]}
        />
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
          {employee.employeeType === 'full_time' && (
            <p className="mt-4 text-sm text-slate-600 bg-slate-100/80 rounded-lg px-4 py-2.5 border border-slate-200">
              {t('passbookFullTimeHelp')}
            </p>
          )}
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
                        <span className="text-green-700 font-medium">₹{formatAmount(row.credit)}</span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      {row.debit > 0 ? (
                        <span className="text-red-700 font-medium">₹{formatAmount(row.debit)}</span>
                      ) : (
                        <span className="text-slate-400">–</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-right font-medium">
                      {((): React.ReactNode => {
                        const bal = row.balance ?? 0;
                        if (bal > 0) return <span className="text-green-700">₹{formatAmount(bal)}</span>;
                        if (bal < 0) return <span className="text-red-700">₹{formatAmount(bal)}</span>;
                        return <span className="text-slate-600">₹0</span>;
                      })()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {rowsWithBalance.length > 0 && (
          <div className="px-4 py-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center">
            <span className="text-sm font-semibold">
              {outstanding >= 0 ? (
                <span className="text-slate-800">{t('outstanding')}: ₹{formatAmount(outstanding)}</span>
              ) : (
                <span className="text-red-700">{t('outstanding')}: ₹{formatAmount(outstanding)} <span className="text-slate-600 font-normal">({t('advance')} {t('toRecover')})</span></span>
              )}
            </span>
            {hasMore && (
              <button
                onClick={() => setPage((p) => p + 1)}
                className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm"
              >
                {t('loadMore')}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
