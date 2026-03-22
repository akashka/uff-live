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
import Modal from '@/components/Modal';
import { formatDate, formatAmount, formatMonth } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { DataTable, DataTableHeader, DataTableHead, DataTableBody, DataTableRow, DataTableCell, DataTableEmpty } from '@/components/ui/DataTable';

type PassbookEntry = { type: string; id: string; date: string; particulars: string; credit: number; debit: number; balance?: number; paymentId?: string; workRecordId?: string };

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
  const [detailEntry, setDetailEntry] = useState<PassbookEntry | null>(null);
  const [detailPaymentFull, setDetailPaymentFull] = useState<Record<string, unknown> | null>(null);
  const [detailWorkRecord, setDetailWorkRecord] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!detailEntry) {
      setDetailPaymentFull(null);
      setDetailWorkRecord(null);
      setDetailError(null);
      return;
    }
    if (detailEntry.paymentId) {
      setDetailLoading(true);
      setDetailPaymentFull(null);
      setDetailWorkRecord(null);
      setDetailError(null);
      fetch(`/api/payments/${detailEntry.paymentId}`)
        .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          if (ok && !data.error) {
            setDetailPaymentFull(data);
            setDetailError(null);
          } else {
            setDetailPaymentFull(null);
            setDetailError(data?.error || t('error'));
          }
        })
        .catch(() => {
          setDetailPaymentFull(null);
          setDetailError(t('error'));
        })
        .finally(() => setDetailLoading(false));
    } else if (detailEntry.workRecordId && employee) {
      setDetailLoading(true);
      setDetailPaymentFull(null);
      setDetailWorkRecord(null);
      setDetailError(null);
      const apiPath = employee.employeeType === 'full_time'
        ? `/api/full-time-work-records/${detailEntry.workRecordId}`
        : `/api/work-records/${detailEntry.workRecordId}`;
      fetch(apiPath)
        .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
        .then(({ ok, data }) => {
          if (ok && !data.error) {
            setDetailWorkRecord(data);
            setDetailError(null);
          } else {
            setDetailWorkRecord(null);
            setDetailError(data?.error || t('error'));
          }
        })
        .catch(() => {
          setDetailWorkRecord(null);
          setDetailError(t('error'));
        })
        .finally(() => setDetailLoading(false));
    }
  }, [detailEntry?.paymentId, detailEntry?.workRecordId, employee, t]);

  const handleRowClick = (row: PassbookEntry) => {
    if (row.paymentId || row.workRecordId) setDetailEntry(row);
  };

  const closeDetail = () => {
    setDetailEntry(null);
    setDetailPaymentFull(null);
    setDetailWorkRecord(null);
    setDetailError(null);
  };

  const PAYMENT_MODES = [
    { value: 'cash', label: 'Cash' },
    { value: 'upi', label: 'UPI' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'other', label: 'Other' },
  ];
  const formatMode = (m: string) => PAYMENT_MODES.find((p) => p.value === m)?.label || m;

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
                <DataTableRow
                  key={row.id}
                  className={(row.paymentId || row.workRecordId) ? 'cursor-pointer' : ''}
                  onClick={() => (row.paymentId || row.workRecordId) && handleRowClick(row)}
                >
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

      <Modal open={!!detailEntry} onClose={closeDetail} title={detailEntry?.paymentId ? t('paymentDetails') : t('workOrder')} size="2xl" footer={
        <button onClick={closeDetail} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
          {t('close')}
        </button>
      }>
        {detailEntry && (
          <div className="space-y-4 text-sm">
            {detailEntry.paymentId ? (
              detailLoading ? (
                <p className="text-slate-500">{t('loading')}</p>
              ) : detailError ? (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-red-700 font-medium">{detailError}</p>
                </div>
              ) : detailPaymentFull ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 bg-slate-50 rounded-xl">
                    <p><span className="font-medium text-slate-700">{t('month')}:</span> {formatMonth((detailPaymentFull.month as string) || '')}</p>
                    <p><span className="font-medium text-slate-700">{t('paymentMode')}:</span> {formatMode((detailPaymentFull.paymentMode as string) || '')}</p>
                    <p><span className="font-medium text-slate-700">{t('baseAmount')}:</span> ₹{formatAmount((detailPaymentFull.baseAmount as number) ?? 0)}</p>
                    {((detailPaymentFull.pfDeducted as number) ?? 0) > 0 && <p><span className="font-medium text-slate-700">{t('pf')}:</span> −₹{formatAmount(detailPaymentFull.pfDeducted as number)}</p>}
                    {((detailPaymentFull.esiDeducted as number) ?? 0) > 0 && <p><span className="font-medium text-slate-700">{t('esi')}:</span> −₹{formatAmount(detailPaymentFull.esiDeducted as number)}</p>}
                    {((detailPaymentFull.otherDeducted as number) ?? 0) > 0 && <p><span className="font-medium text-slate-700">{t('otherDeductions')}:</span> −₹{formatAmount(detailPaymentFull.otherDeducted as number)}</p>}
                    {((detailPaymentFull.advanceDeducted as number) ?? 0) > 0 && <p><span className="font-medium text-slate-700">{t('advanceDeducted')}:</span> −₹{formatAmount(detailPaymentFull.advanceDeducted as number)}</p>}
                    {((detailPaymentFull.addDeductAmount as number) ?? 0) !== 0 && <p><span className="font-medium text-slate-700">{t('addDeduct')}:</span> {((detailPaymentFull.addDeductAmount as number) ?? 0) > 0 ? '+' : ''}₹{formatAmount(detailPaymentFull.addDeductAmount as number)}</p>}
                    <p className="sm:col-span-2 pt-2 border-t border-slate-200"><span className="font-semibold text-slate-800">{t('totalPayable')}:</span> ₹{formatAmount((detailPaymentFull.totalPayable as number) ?? 0)}</p>
                    <p><span className="font-semibold text-slate-800">{t('paymentAmount')}:</span> ₹{formatAmount((detailPaymentFull.paymentAmount as number) ?? 0)}</p>
                    {(detailPaymentFull.transactionRef as string) && <p><span className="font-medium text-slate-700">{t('transactionRef')}:</span> {detailPaymentFull.transactionRef as string}</p>}
                  </div>
                  {(detailPaymentFull.fullTimeWorkRecordRefs as { fullTimeWorkRecord?: { branch?: { name: string }; daysWorked?: number; otHours?: number; otAmount?: number; totalAmount?: number }; daysWorked?: number; otHours?: number; otAmount?: number }[])?.length > 0 && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="font-medium text-slate-800 mb-2">{t('workOrders')}</p>
                      {(detailPaymentFull.fullTimeWorkRecordRefs as { fullTimeWorkRecord?: { branch?: { name: string }; daysWorked?: number; otHours?: number; otAmount?: number; totalAmount?: number }; daysWorked?: number; otHours?: number; otAmount?: number }[]).map((ref: { fullTimeWorkRecord?: { branch?: { name: string }; daysWorked?: number; otHours?: number; otAmount?: number; totalAmount?: number }; daysWorked?: number; otHours?: number; otAmount?: number }, i: number) => {
                        const ft = ref.fullTimeWorkRecord;
                        if (!ft) return null;
                        return (
                          <div key={i} className="py-2 border-b border-slate-200 last:border-0">
                            <p className="font-medium text-slate-700">{(ft.branch as { name?: string })?.name || t('branch')}</p>
                            <p className="text-slate-600 text-sm">{t('daysWorked')}: {ref.daysWorked ?? ft.daysWorked ?? 0} | {t('otHours')}: {ref.otHours ?? ft.otHours ?? 0} → ₹{formatAmount(ref.otAmount ?? ft.otAmount ?? 0)}</p>
                            <p className="font-medium">₹{formatAmount(ft.totalAmount ?? 0)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {(detailPaymentFull.workRecordRefs as { workRecord?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string }; workItems?: { rateName: string; quantity: number; ratePerUnit: number; amount: number }[]; totalAmount?: number }; totalAmount?: number }[])?.length > 0 && (
                    <div className="p-4 bg-slate-50 rounded-xl">
                      <p className="font-medium text-slate-800 mb-2">{t('workOrders')}</p>
                      {(detailPaymentFull.workRecordRefs as { workRecord?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string }; workItems?: { rateName: string; quantity: number; ratePerUnit: number; amount: number }[]; totalAmount?: number }; totalAmount?: number }[]).map((ref: { workRecord?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string }; workItems?: { rateName: string; quantity: number; ratePerUnit: number; amount: number }[]; totalAmount?: number }; totalAmount?: number }, i: number) => {
                        const wr = ref.workRecord;
                        if (!wr) return null;
                        const styleStr = wr.styleOrder ? ` – ${wr.styleOrder.styleCode}` : '';
                        return (
                          <div key={i} className="py-2 border-b border-slate-200 last:border-0">
                            <p className="font-medium text-slate-700">{(wr.branch as { name?: string })?.name || t('workRecord')}{styleStr}</p>
                            {((wr.workItems || []).filter((item): item is { rateName: string; quantity: number; ratePerUnit: number; amount: number } => !!item)).map((item, j) => (
                              <p key={j} className="text-slate-600 text-sm ml-2">{item.rateName}: {item.quantity} × ₹{formatAmount(item.ratePerUnit)} = ₹{formatAmount(item.amount)}</p>
                            ))}
                            <p className="font-medium">₹{formatAmount(wr.totalAmount ?? ref.totalAmount ?? 0)}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-slate-500">{t('loading')}</p>
              )
            ) : detailEntry.workRecordId ? (
              detailLoading ? (
                <p className="text-slate-500">{t('loading')}</p>
              ) : detailError ? (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                  <p className="text-red-700 font-medium">{detailError}</p>
                </div>
              ) : detailWorkRecord ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p className="font-medium text-slate-800">{(detailWorkRecord.branch as { name?: string })?.name || t('branch')} – {formatMonth((detailWorkRecord.month as string) || '')}</p>
                    {(detailWorkRecord as { daysWorked?: number }).daysWorked != null && (
                      <p className="text-slate-700">{t('daysWorked')}: {(detailWorkRecord as { daysWorked: number }).daysWorked}</p>
                    )}
                    {((detailWorkRecord as { otHours?: number }).otHours ?? 0) > 0 && (
                      <p className="text-slate-700">{t('otHours')}: {(detailWorkRecord as { otHours: number }).otHours} → ₹{formatAmount((detailWorkRecord as { otAmount?: number }).otAmount ?? 0)}</p>
                    )}
                    {((detailWorkRecord.workItems as { rateName?: string; quantity?: number; ratePerUnit?: number; amount?: number }[] | undefined) || []).filter((item) => item && typeof item.quantity === 'number').length > 0 && (
                      <div className="mt-2 space-y-1">
                        {((detailWorkRecord.workItems as { rateName?: string; quantity?: number; ratePerUnit?: number; amount?: number }[] | undefined) || []).filter((item) => item && typeof item.quantity === 'number').map((item, j) => (
                          <p key={j} className="text-slate-600 text-sm">{item.rateName}: {item.quantity} × ₹{formatAmount(item.ratePerUnit)} = ₹{formatAmount(item.amount)}</p>
                        ))}
                      </div>
                    )}
                    <p className="font-semibold mt-2">{t('amount')}: ₹{formatAmount((detailWorkRecord.totalAmount as number) ?? 0)}</p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-slate-700">{detailEntry.particulars}</p>
                  <p className="font-semibold mt-2">{detailEntry.credit > 0 ? t('credit') : t('debit')}: ₹{formatAmount(detailEntry.credit || detailEntry.debit)}</p>
                  <p className="text-slate-600 text-sm mt-1">{t('date')}: {detailEntry.date ? formatDate(detailEntry.date) : '–'}</p>
                </div>
              )
            ) : null}
          </div>
        )}
      </Modal>
    </div>
  );
}
