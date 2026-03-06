'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import { PageLoader, Skeleton } from '@/components/Skeleton';

interface Employee {
  _id: string;
  name: string;
  employeeType: string;
  pfOpted?: boolean;
  monthlyPfAmount?: number;
  monthlySalary?: number;
  salaryBreakup?: { pf?: number; esi?: number; other?: number };
}

interface WorkRecord {
  _id: string;
  branch: { name: string };
  periodStart: string;
  periodEnd: string;
  workItems: { rateName: string; quantity: number; ratePerUnit: number; amount: number }[];
  totalAmount: number;
}

interface Payment {
  _id: string;
  employee: { name: string; employeeType: string };
  paymentType: string;
  paymentRun?: string;
  periodStart: string;
  periodEnd: string;
  baseAmount: number;
  addDeductAmount: number;
  addDeductRemarks: string;
  pfDeducted: number;
  esiDeducted: number;
  advanceDeducted?: number;
  totalPayable: number;
  paymentAmount: number;
  paymentMode: string;
  transactionRef: string;
  remainingAmount: number;
  carriedForward: number;
  carriedForwardRemarks?: string;
  isAdvance: boolean;
  paidAt: string;
}

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export default function PaymentsPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [carryModal, setCarryModal] = useState<{ remaining: number; onConfirm: (amount: number, remarks: string) => void } | null>(null);
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterRun, setFilterRun] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [exportModal, setExportModal] = useState(false);
  const [exportRun, setExportRun] = useState('');
  const [exportStart, setExportStart] = useState('');
  const [exportEnd, setExportEnd] = useState('');
  const [exportIncludeZero, setExportIncludeZero] = useState(true);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('excel');

  const canAdd = ['admin', 'finance'].includes(user?.role || '');
  const canView = ['admin', 'finance', 'hr'].includes(user?.role || '');

  const [form, setForm] = useState({
    employeeId: '',
    paymentType: 'contractor' as 'contractor' | 'full_time',
    periodStart: '',
    periodEnd: '',
    baseAmount: 0,
    addDeductAmount: 0,
    addDeductRemarks: '',
    pfDeducted: 0,
    esiDeducted: 0,
    advanceDeducted: 0,
    totalPayable: 0,
    paymentAmount: 0,
    paymentMode: 'cash' as string,
    transactionRef: '',
    remainingAmount: 0,
    carriedForward: 0,
    carriedForwardRemarks: '',
    isAdvance: false,
    workRecordIds: [] as string[],
    paymentRun: '',
  });

  const fetchPayments = () => {
    let url = '/api/payments';
    const params = new URLSearchParams();
    if (filterEmployee) params.set('employeeId', filterEmployee);
    if (filterRun) params.set('paymentRun', filterRun);
    if (params.toString()) url += '?' + params.toString();
    fetch(url)
      .then((r) => r.json())
      .then((data) => setPayments(Array.isArray(data) ? data : []))
      .catch(() => setMessage({ type: 'error', text: t('error') }));
  };

  useEffect(() => {
    if (!canView) return;
    setLoading(true);
    fetchPayments();
    fetch('/api/employees?includeInactive=false')
      .then((r) => r.json())
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => {});
    setLoading(false);
  }, [canView, filterEmployee, filterRun]);

  const openAdd = (emp?: Employee) => {
    if (employees.length === 0 && !emp?._id) {
      setMessage({ type: 'error', text: t('noEmployees') });
      return;
    }
    const empId = emp?._id || '';
    const pType = emp?.employeeType === 'contractor' ? 'contractor' : 'full_time';
    setForm({
      employeeId: empId,
      paymentType: pType,
      periodStart: '',
      periodEnd: '',
      baseAmount: 0,
      addDeductAmount: 0,
      addDeductRemarks: '',
      pfDeducted: 0,
      esiDeducted: 0,
      advanceDeducted: 0,
      totalPayable: 0,
      paymentAmount: 0,
      paymentMode: 'cash',
      transactionRef: '',
      remainingAmount: 0,
      carriedForward: 0,
      carriedForwardRemarks: '',
      isAdvance: false,
      workRecordIds: [],
      paymentRun: '',
    });
    setModal(true);
    if (empId) {
      if (pType === 'full_time') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        setForm((f) => ({ ...f, periodStart: start.toISOString().slice(0, 10), periodEnd: end.toISOString().slice(0, 10) }));
        loadCalculation(empId, pType, start.toISOString().slice(0, 10), end.toISOString().slice(0, 10));
      } else {
        fetch(`/api/payments/last-paid?employeeId=${empId}`)
          .then((r) => r.json())
          .then((last) => {
            const lastEnd = last.lastPeriodEnd ? new Date(last.lastPeriodEnd) : new Date(0);
            const s = new Date(lastEnd);
            s.setDate(s.getDate() + 1);
            const e = new Date();
            const start = s.toISOString().slice(0, 10);
            const end = e.toISOString().slice(0, 10);
            setForm((f) => ({ ...f, periodStart: start, periodEnd: end }));
            loadCalculation(empId, pType, start, end);
          });
      }
    }
  };

  const loadCalculation = async (empId: string, type: string, start: string, end: string) => {
    if (!empId || !start || !end) return;
    const calc = await fetch(`/api/payments/calculate?employeeId=${empId}&periodStart=${start}&periodEnd=${end}&type=${type}`).then((r) => r.json());
    if (calc.error) return;
    const base = calc.baseAmount || 0;
    const pf = type === 'contractor' ? (calc.pfToDeduct || 0) : 0;
    const esi = type === 'contractor' ? (calc.esiToDeduct || 0) : 0;
    const total = base - pf - esi;
    setForm((f) => ({
      ...f,
      baseAmount: base,
      pfDeducted: pf,
      esiDeducted: esi,
      totalPayable: total + f.addDeductAmount,
      workRecordIds: type === 'contractor' ? (calc.workRecords || []).map((r: WorkRecord) => r._id) : [],
    }));
  };

  const onEmployeeChange = (empId: string) => {
    const emp = employees.find((e) => e._id === empId);
    setForm((f) => ({
      ...f,
      employeeId: empId,
      paymentType: emp?.employeeType === 'contractor' ? 'contractor' : 'full_time',
    }));
  };

  const onPeriodChange = () => {
    if (form.employeeId && form.periodStart && form.periodEnd) {
      loadCalculation(form.employeeId, form.paymentType, form.periodStart, form.periodEnd);
    }
  };

  const totalPayable = form.baseAmount + form.addDeductAmount - form.pfDeducted - form.esiDeducted - (form.advanceDeducted ?? 0);
  const remaining = totalPayable - form.paymentAmount;

  const handleSubmit = async () => {
    if (remaining > 0 && !carryModal) {
      setCarryModal({
        remaining,
        onConfirm: (amount, remarks) => {
          setCarryModal(null);
          doSubmit(amount, remarks);
        },
      });
      return;
    }
    doSubmit(0, '');
  };

  const doSubmit = async (carryAmount?: number, carryRemarks?: string) => {
    setSaving(true);
    setMessage(null);
    try {
      const cf = carryAmount ?? form.carriedForward;
      const cfRemarks = carryRemarks ?? form.carriedForwardRemarks;
      const rem = remaining;
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          totalPayable: form.baseAmount + form.addDeductAmount - form.pfDeducted - form.esiDeducted - (form.advanceDeducted ?? 0),
          remainingAmount: rem,
          carriedForward: cf,
          carriedForwardRemarks: cfRemarks,
          paymentRun: form.paymentRun || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      setMessage({ type: 'success', text: t('saveSuccess') });
      setModal(false);
      fetchPayments();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('error') });
    } finally {
      setSaving(false);
    }
  };

  const formatMode = (m: string) => PAYMENT_MODES.find((p) => p.value === m)?.label || m;

  if (!canView) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <p className="text-slate-600">{t('accessDenied')}</p>
      </div>
    );
  }

  const filtered = (Array.isArray(payments) ? payments : []).filter((p) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const name = (p.employee as { name?: string })?.name || '';
    return name.toLowerCase().includes(q);
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'amount-desc') return (b.paymentAmount || 0) - (a.paymentAmount || 0);
    if (sortBy === 'amount-asc') return (a.paymentAmount || 0) - (b.paymentAmount || 0);
    if (sortBy === 'date-asc') return (a.paidAt || '').localeCompare(b.paidAt || '');
    return (b.paidAt || '').localeCompare(a.paidAt || '');
  });
  const SORT_OPTIONS = [
    { value: 'date-desc', label: `${t('period')} (newest)` },
    { value: 'date-asc', label: `${t('period')} (oldest)` },
    { value: 'amount-desc', label: `${t('paymentAmount')} (high–low)` },
    { value: 'amount-asc', label: `${t('paymentAmount')} (low–high)` },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title={t('payments')}>
          <Skeleton className="h-10 w-24" variant="rect" />
        </PageHeader>
        <PageLoader mode="table" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('payments')}>
        <div className="flex gap-2">
          {canAdd && (
            <>
              <button onClick={() => setExportModal(true)} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-uff-surface font-medium">
                {t('exportBankFormat')}
              </button>
              <button onClick={() => openAdd()} disabled={!Array.isArray(employees) || employees.length === 0} className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed" title={!Array.isArray(employees) || employees.length === 0 ? t('noEmployees') : ''}>
                {t('add')} {t('payment')}
              </button>
            </>
          )}
        </div>
      </PageHeader>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <ListToolbar search={search} onSearchChange={setSearch} sortBy={sortBy} onSortChange={setSortBy} sortOptions={SORT_OPTIONS} viewMode={viewMode} onViewModeChange={setViewMode} searchPlaceholder={t('search')}>
        <div className="flex flex-wrap gap-3 items-center">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('employeeName')}</label>
            <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white">
              <option value="">{t('all')}</option>
              {(Array.isArray(employees) ? employees : []).map((e) => (
                <option key={e._id} value={e._id}>{e.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('paymentRun')}</label>
            <input type="text" value={filterRun} onChange={(e) => setFilterRun(e.target.value)} placeholder="e.g. March 2025" className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white w-40" />
          </div>
        </div>
      </ListToolbar>

      {viewMode === 'table' ? (
      <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('employeeName')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('period')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('totalAmount')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('paymentAmount')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('paymentMode')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('status')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-600">{t('noData')}</td>
                </tr>
              ) : (
                sorted.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-800">{(p.employee as { name?: string })?.name}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">
                      {p.periodStart?.slice(0, 10)} – {p.periodEnd?.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-right">₹{p.totalPayable?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{p.paymentAmount?.toLocaleString()}</td>
                    <td className="px-4 py-3 text-slate-800">{formatMode(p.paymentMode)}</td>
                    <td className="px-4 py-3">
                      {p.remainingAmount > 0 ? (
                        <span className="text-uff-accent text-sm">₹{p.remainingAmount?.toLocaleString()} {t('due')}</span>
                      ) : p.isAdvance ? (
                        <span className="text-blue-600 text-sm">{t('advance')}</span>
                      ) : (
                        <span className="text-green-600 text-sm">{t('paid')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => setDetailPayment(p)}
                        className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium text-sm hover:bg-slate-100 transition"
                      >
                        {t('view')}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.length === 0 ? (
            <div className="col-span-full rounded-xl bg-white p-12 text-center text-slate-600 border border-slate-200">{t('noData')}</div>
          ) : (
            sorted.map((p) => (
              <div key={p._id} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                <h3 className="font-semibold text-slate-900">{(p.employee as { name?: string })?.name}</h3>
                <p className="text-sm text-slate-600">{p.periodStart?.slice(0, 10)} – {p.periodEnd?.slice(0, 10)}</p>
                <p className="mt-2 font-semibold text-slate-900">₹{p.paymentAmount?.toLocaleString()}</p>
                <p className="text-sm text-slate-600">{formatMode(p.paymentMode)}</p>
                {p.remainingAmount > 0 ? (
                  <span className="inline-block mt-2 text-uff-accent text-sm">₹{p.remainingAmount?.toLocaleString()} {t('due')}</span>
                ) : p.isAdvance ? (
                  <span className="inline-block mt-2 text-blue-600 text-sm">{t('advance')}</span>
                ) : (
                  <span className="inline-block mt-2 text-green-600 text-sm">{t('paid')}</span>
                )}
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={() => setDetailPayment(p)}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium text-sm hover:bg-slate-100 transition"
                  >
                    {t('view')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {modal && canAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">{t('add')} {t('payment')}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('employeeName')}</label>
                <select
                  value={form.employeeId}
                  onChange={(e) => onEmployeeChange(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                >
                  <option value="">{!Array.isArray(employees) || employees.length === 0 ? t('noEmployees') : 'Select...'}</option>
                  {(Array.isArray(employees) ? employees : []).map((e) => (
                    <option key={e._id} value={e._id}>{e.name} ({e.employeeType === 'contractor' ? t('contractor') : t('fullTime')})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('periodStart')}</label>
                  <input
                    type="date"
                    value={form.periodStart}
                    onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
                    onBlur={onPeriodChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('periodEnd')}</label>
                  <input
                    type="date"
                    value={form.periodEnd}
                    onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
                    onBlur={onPeriodChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <button type="button" onClick={() => form.employeeId && onPeriodChange()} className="text-sm text-uff-accent hover:text-uff-accent-hover">
                {t('calculate')}
              </button>

              <div className="p-3 bg-slate-100 rounded-lg">
                <p className="text-sm text-slate-800">{t('baseAmount')}: ₹{form.baseAmount?.toLocaleString()}</p>
                {form.paymentType === 'contractor' && form.pfDeducted > 0 && (
                  <p className="text-sm text-slate-800">{t('pf')} {t('deducted')}: -₹{form.pfDeducted?.toLocaleString()}</p>
                )}
                {form.paymentType === 'contractor' && form.esiDeducted > 0 && (
                  <p className="text-sm text-slate-800">{t('esi')} {t('deducted')}: -₹{form.esiDeducted?.toLocaleString()}</p>
                )}
                {(form.advanceDeducted ?? 0) > 0 && (
                  <p className="text-sm text-slate-800">{t('advance')} {t('deducted')}: -₹{(form.advanceDeducted ?? 0).toLocaleString()}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('addDeduct')} (₹)</label>
                  <input
                    type="number"
                    value={form.addDeductAmount || ''}
                    onChange={(e) => setForm((f) => ({ ...f, addDeductAmount: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="+/- amount"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('remarks')}</label>
                  <input
                    type="text"
                    value={form.addDeductRemarks}
                    onChange={(e) => setForm((f) => ({ ...f, addDeductRemarks: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="Remarks"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('advanceDeducted')} (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.advanceDeducted ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, advanceDeducted: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('totalPayable')}</label>
                <p className="text-lg font-semibold">₹{totalPayable.toLocaleString()}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('paymentAmount')} (₹)</label>
                <input
                  type="number"
                  value={form.paymentAmount || ''}
                  onChange={(e) => setForm((f) => ({ ...f, paymentAmount: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('paymentMode')}</label>
                <select
                  value={form.paymentMode}
                  onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {PAYMENT_MODES.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('transactionRef')}</label>
                <input
                  type="text"
                  value={form.transactionRef}
                  onChange={(e) => setForm((f) => ({ ...f, transactionRef: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="Transaction ref, cheque no..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('paymentRun')}</label>
                <input
                  type="text"
                  value={form.paymentRun}
                  onChange={(e) => setForm((f) => ({ ...f, paymentRun: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. March 2025"
                />
              </div>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={form.isAdvance} onChange={(e) => setForm((f) => ({ ...f, isAdvance: e.target.checked }))} className="rounded" />
                <span className="text-sm">{t('isAdvance')}</span>
              </label>

              {remaining > 0 && (
                <p className="text-uff-accent text-sm">{t('remainingDue')}: ₹{remaining.toLocaleString()}</p>
              )}
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleSubmit}
                disabled={saving || !form.employeeId || !form.periodStart || !form.periodEnd || !form.paymentAmount}
                className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-white font-medium disabled:opacity-50"
              >
                {saving ? '...' : t('save')}
              </button>
              <button onClick={() => setModal(false)} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {detailPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[55]" onClick={() => setDetailPayment(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">{t('paymentDetails')}</h2>
            <div className="space-y-2 text-sm">
              <p><span className="font-medium text-slate-700">{t('employeeName')}:</span> {(detailPayment.employee as { name?: string })?.name}</p>
              <p><span className="font-medium text-slate-700">{t('period')}:</span> {detailPayment.periodStart?.slice(0, 10)} – {detailPayment.periodEnd?.slice(0, 10)}</p>
              <p><span className="font-medium text-slate-700">{t('baseAmount')}:</span> ₹{detailPayment.baseAmount?.toLocaleString()}</p>
              {detailPayment.addDeductAmount !== 0 && (
                <p><span className="font-medium text-slate-700">{t('addDeduct')}:</span> {detailPayment.addDeductAmount > 0 ? '+' : ''}₹{detailPayment.addDeductAmount?.toLocaleString()} {detailPayment.addDeductRemarks && `(${detailPayment.addDeductRemarks})`}</p>
              )}
              {detailPayment.pfDeducted > 0 && (
                <p><span className="font-medium text-slate-700">{t('pf')}:</span> -₹{detailPayment.pfDeducted?.toLocaleString()}</p>
              )}
              {detailPayment.esiDeducted > 0 && (
                <p><span className="font-medium text-slate-700">{t('esi')}:</span> -₹{detailPayment.esiDeducted?.toLocaleString()}</p>
              )}
              {(detailPayment.advanceDeducted ?? 0) > 0 && (
                <p><span className="font-medium text-slate-700">{t('advance')}:</span> -₹{(detailPayment.advanceDeducted ?? 0).toLocaleString()}</p>
              )}
              <p><span className="font-medium text-slate-700">{t('totalPayable')}:</span> ₹{detailPayment.totalPayable?.toLocaleString()}</p>
              <p><span className="font-medium text-slate-700">{t('paymentAmount')}:</span> ₹{detailPayment.paymentAmount?.toLocaleString()}</p>
              <p><span className="font-medium text-slate-700">{t('paymentMode')}:</span> {formatMode(detailPayment.paymentMode)}</p>
              {detailPayment.transactionRef && <p><span className="font-medium text-slate-700">{t('transactionRef')}:</span> {detailPayment.transactionRef}</p>}
              {detailPayment.remainingAmount > 0 && <p className="text-uff-accent"><span className="font-medium">{t('remainingDue')}:</span> ₹{detailPayment.remainingAmount?.toLocaleString()}</p>}
              {detailPayment.carriedForward > 0 && <p><span className="font-medium text-slate-700">{t('carryForward')}:</span> ₹{detailPayment.carriedForward?.toLocaleString()} {detailPayment.carriedForwardRemarks && `(${detailPayment.carriedForwardRemarks})`}</p>}
              {detailPayment.isAdvance && <p className="text-blue-600">{t('advance')}</p>}
            </div>
            <button onClick={() => setDetailPayment(null)} className="mt-4 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50">
              {t('close')}
            </button>
          </div>
        </div>
      )}

      {carryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold mb-2">{t('remainingAmount')}</h2>
            <p className="text-slate-600 mb-4">
              {t('remainingDue')}: ₹{carryModal.remaining.toLocaleString()}. {t('carryForwardQuestion')}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('carryForwardAmount')}</label>
                <input
                  type="number"
                  id="carry-amount"
                  defaultValue={carryModal.remaining}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('remarks')}</label>
                <input type="text" id="carry-remarks" className="w-full px-3 py-2 border border-slate-300 rounded-lg" placeholder="Remarks" />
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => {
                  carryModal.onConfirm(0, '');
                }}
                className="px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white"
              >
                {t('makeZero')}
              </button>
              <button
                onClick={() => {
                  const amt = parseFloat((document.getElementById('carry-amount') as HTMLInputElement)?.value || '0') || 0;
                  const remarks = (document.getElementById('carry-remarks') as HTMLInputElement)?.value || '';
                  carryModal.onConfirm(amt, remarks);
                }}
                className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-white"
              >
                {t('carryForward')}
              </button>
            </div>
          </div>
        </div>
      )}

      {exportModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold mb-4">{t('exportBankFormat')}</h2>
            <p className="text-sm text-slate-600 mb-4">
              Export payments in bank transfer format (Amount, Beneficiary_Name, IFSC, Account_No) for NEFT/IMPS.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('paymentRun')}</label>
                <input
                  type="text"
                  value={exportRun}
                  onChange={(e) => setExportRun(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  placeholder="e.g. March 2025 (leave empty for all)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('periodStart')}</label>
                  <input
                    type="date"
                    value={exportStart}
                    onChange={(e) => setExportStart(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('periodEnd')}</label>
                  <input
                    type="date"
                    value={exportEnd}
                    onChange={(e) => setExportEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('exportFormat')}</label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as 'csv' | 'excel')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                >
                  <option value="excel">Excel (.xlsx)</option>
                  <option value="csv">CSV</option>
                </select>
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={exportIncludeZero}
                  onChange={(e) => setExportIncludeZero(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">{t('includeZeroAmounts')}</span>
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set('format', exportFormat);
                  params.set('includeZero', String(exportIncludeZero));
                  if (exportRun) params.set('paymentRun', exportRun);
                  if (exportStart) params.set('startDate', exportStart);
                  if (exportEnd) params.set('endDate', exportEnd);
                  window.open(`/api/payments/export?${params.toString()}`, '_blank');
                  setExportModal(false);
                }}
                className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium"
              >
                Export
              </button>
              <button
                onClick={() => setExportModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-uff-surface"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
