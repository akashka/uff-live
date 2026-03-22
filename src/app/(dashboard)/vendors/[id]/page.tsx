'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import Breadcrumb from '@/components/Breadcrumb';
import { PageLoader } from '@/components/Skeleton';
import { formatDate, formatAmount } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { DataTable, DataTableHeader, DataTableHead, DataTableBody, DataTableRow, DataTableCell, DataTableEmpty } from '@/components/ui/DataTable';

type PassbookEntry = { type: string; id: string; date: string; particulars: string; credit: number; debit: number; balance?: number };

export default function VendorDetailPage() {
  const { t } = useApp();
  const { user, loading: authLoading } = useAuth();
  const params = useParams();
  const vendorId = params?.id as string | undefined;

  const canAccess = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '');
  const [vendor, setVendor] = useState<{ _id: string; name: string; vendorId?: string } | null>(null);
  const [entries, setEntries] = useState<PassbookEntry[]>([]);
  const [outstanding, setOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [vendorId]);

  useEffect(() => {
    if (!vendorId || authLoading) return;
    if (!canAccess) {
      setError(t('accessDenied'));
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    fetch(`/api/vendors/${vendorId}/passbook?page=${page}&limit=50`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          return;
        }
        setVendor(data.vendor);
        setEntries((prev) => (page === 1 ? data.data : [...prev, ...data.data]));
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setOutstanding(data.outstanding ?? 0);
      })
      .catch(() => {
        setError(t('error'));
        toast.error(t('error'));
      })
      .finally(() => setLoading(false));
  }, [vendorId, canAccess, authLoading, page, t]);

  if (authLoading) {
    return (
      <div>
        <PageHeader title={t('vendorPassbook')} />
        <PageLoader mode="table" />
      </div>
    );
  }

  if (!canAccess) {
    return (
      <div>
        <PageHeader title={t('vendorPassbook')} />
        <div className="mb-4 -mt-2">
          <Breadcrumb items={[{ label: t('jobworkVendors'), href: '/vendors' }]} />
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center">
          <p className="text-slate-600">{t('accessDenied')}</p>
          <Link href="/vendors" className="mt-4 inline-block text-uff-accent hover:underline">
            {t('backToVendors')}
          </Link>
        </div>
      </div>
    );
  }

  if (loading && !vendor) {
    return (
      <div>
        <PageHeader title={t('vendorPassbook')} />
        <PageLoader mode="table" />
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div>
        <PageHeader title={t('vendorPassbook')} />
        <div className="mb-4 -mt-2">
          <Breadcrumb items={[{ label: t('jobworkVendors'), href: '/vendors' }]} />
        </div>
        <div className="rounded-xl bg-white border border-slate-200 p-8 text-center">
          <p className="text-slate-600">{error || t('noData')}</p>
          <Link href="/vendors" className="mt-4 inline-block text-uff-accent hover:underline">
            {t('backToVendors')}
          </Link>
        </div>
      </div>
    );
  }

  const rowsWithBalance = entries;

  return (
    <div>
      <PageHeader title={t('vendorPassbook')}>
        {rowsWithBalance.length > 0 && (
          <a
            href={`/api/vendors/${vendorId}/passbook?format=excel`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {t('export')} Excel
          </a>
        )}
      </PageHeader>
      <div className="mb-4 -mt-2">
        <Breadcrumb
          items={[
            { label: t('jobworkVendors'), href: '/vendors' },
            { label: vendor?.name || t('vendorPassbook') },
          ]}
        />
      </div>

      <div className="rounded-xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 sm:p-6 border-b border-slate-200 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{vendor.name}</h2>
            <p className="text-sm text-slate-600">
              {vendor.vendorId && <span className="font-mono">{vendor.vendorId}</span>}
            </p>
          </div>
          <p className="mt-4 text-sm text-slate-600 bg-slate-100/80 rounded-lg px-4 py-2.5 border border-slate-200">
            Credit = Work orders. Debit = Payments (advance or monthly).
          </p>
        </div>

        <DataTable>
          <DataTableHeader>
            <tr>
              <DataTableHead>{t('date')}</DataTableHead>
              <DataTableHead>{t('particulars')}</DataTableHead>
              <DataTableHead align="right">{t('credit')}</DataTableHead>
              <DataTableHead align="right">{t('debit')}</DataTableHead>
              <DataTableHead align="right">{t('balance')}</DataTableHead>
            </tr>
          </DataTableHeader>
          <DataTableBody>
            {rowsWithBalance.length === 0 ? (
              <DataTableEmpty colSpan={5}>{t('noData')}</DataTableEmpty>
            ) : (
              rowsWithBalance.map((row) => (
                <DataTableRow key={row.id}>
                  <DataTableCell className="text-sm text-slate-600 whitespace-nowrap">
                    {row.date ? formatDate(row.date) : '–'}
                  </DataTableCell>
                  <DataTableCell className="max-w-xs truncate" title={row.particulars}>
                    {row.particulars}
                  </DataTableCell>
                  <DataTableCell align="right">
                    {row.credit > 0 ? (
                      <span className="text-emerald-700 font-medium">₹{formatAmount(row.credit)}</span>
                    ) : (
                      <span className="text-slate-400">–</span>
                    )}
                  </DataTableCell>
                  <DataTableCell align="right">
                    {row.debit > 0 ? (
                      <span className="text-red-600 font-medium">₹{formatAmount(row.debit)}</span>
                    ) : (
                      <span className="text-slate-400">–</span>
                    )}
                  </DataTableCell>
                  <DataTableCell align="right" className="font-medium">
                    {((): React.ReactNode => {
                      const bal = row.balance ?? 0;
                      if (bal > 0) return <span className="text-emerald-700">₹{formatAmount(bal)}</span>;
                      if (bal < 0) return <span className="text-red-600">₹{formatAmount(bal)}</span>;
                      return <span className="text-slate-600">₹0</span>;
                    })()}
                  </DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>

        {rowsWithBalance.length > 0 && (
          <div className="px-4 py-3 bg-slate-100 border-t border-slate-200 flex justify-between items-center">
            <span className="text-sm font-semibold">
              <span className="text-slate-800">{t('outstanding')}: ₹{formatAmount(outstanding)}</span>
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
