'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import Modal from '@/components/Modal';
import SaveOverlay from '@/components/SaveOverlay';
import { PageLoader, Skeleton } from '@/components/Skeleton';
import { useVendors, useVendorPayments, useVendorWorkOrders } from '@/lib/hooks/useApi';
import ValidatedInput from '@/components/ValidatedInput';
import { formatMonth, formatAmount } from '@/lib/utils';
import { toast } from '@/lib/toast';
import SearchableSelect from '@/components/ui/SearchableSelect';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export default function VendorPayments() {
  const { t } = useApp();
  const { user } = useAuth();
  const canView = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '');
  const canAdd = ['admin', 'finance'].includes(user?.role || '');

  const [filterVendor, setFilterVendor] = useState('');
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth());
  const [filterType, setFilterType] = useState<'all' | 'advance' | 'monthly'>('all');
  const [page, setPage] = useState(1);
  const { payments, total, limit, hasMore, loading, mutate } = useVendorPayments(
    filterVendor || undefined,
    canView,
    {
      page,
      limit: 50,
      month: filterMonth,
      paymentType: filterType === 'all' ? undefined : filterType,
    }
  );
  const { vendors } = useVendors(false, { limit: 0 });
  const [modal, setModal] = useState(false);
  const [advanceModal, setAdvanceModal] = useState(false);
  const [detailPayment, setDetailPayment] = useState<{ vendor?: { name?: string }; month?: string; baseAmount?: number; totalPayable?: number; paymentAmount?: number; paymentMode?: string; paymentType?: string } | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [calc, setCalc] = useState<any>(null);

  const [form, setForm] = useState({
    vendorId: '',
    paymentType: 'monthly' as 'advance' | 'monthly',
    month: getCurrentMonth(),
    baseAmount: 0,
    addDeductAmount: 0,
    addDeductRemarks: '',
    totalPayable: 0,
    paymentAmount: 0,
    paymentMode: 'cash' as string,
    transactionRef: '',
    remainingAmount: 0,
    carriedForward: 0,
    carriedForwardRemarks: '',
    vendorWorkOrderIds: [] as string[],
  });

  const [advanceForm, setAdvanceForm] = useState({
    vendorId: '',
    month: getCurrentMonth(),
    amount: 0,
    remarks: '',
    paymentMode: 'cash' as string,
    transactionRef: '',
  });

  useEffect(() => {
    setPage(1);
  }, [filterVendor, filterMonth, filterType]);

  const openAdvanceModal = () => {
    if (vendors.length === 0) {
      toast.error(t('noVendors'));
      return;
    }
    setAdvanceForm({
      vendorId: filterVendor || '',
      month: getCurrentMonth(),
      amount: 0,
      remarks: '',
      paymentMode: 'cash',
      transactionRef: '',
    });
    setAdvanceModal(true);
  };

  const handleAdvanceSubmit = async () => {
    if (!advanceForm.vendorId || !advanceForm.amount || advanceForm.amount <= 0) {
      toast.error(t('error'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/vendor-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: advanceForm.vendorId,
          paymentType: 'advance',
          month: advanceForm.month,
          baseAmount: 0,
          addDeductAmount: 0,
          addDeductRemarks: advanceForm.remarks,
          totalPayable: advanceForm.amount,
          paymentAmount: advanceForm.amount,
          paymentMode: advanceForm.paymentMode,
          transactionRef: advanceForm.transactionRef,
          remainingAmount: 0,
          carriedForward: 0,
          carriedForwardRemarks: '',
          vendorWorkOrderIds: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('saveSuccess'));
      await mutate();
      setAdvanceModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const openAdd = () => {
    if (vendors.length === 0) {
      toast.error(t('noVendors'));
      return;
    }
    setForm({
      vendorId: filterVendor || '',
      paymentType: 'monthly',
      month: getCurrentMonth(),
      baseAmount: 0,
      addDeductAmount: 0,
      addDeductRemarks: '',
      totalPayable: 0,
      paymentAmount: 0,
      paymentMode: 'cash',
      transactionRef: '',
      remainingAmount: 0,
      carriedForward: 0,
      carriedForwardRemarks: '',
      vendorWorkOrderIds: [],
    });
    setModal(true);
  };

  const loadCalculation = async (vendorId: string, month: string, selectedIds?: string[]) => {
    if (!vendorId || !month) return;
    const voParam = selectedIds ? `&selectedVendorWorkOrderIds=${selectedIds.join(',')}` : '';
    const calc = await fetch(`/api/vendor-payments/calculate?vendorId=${vendorId}&month=${month}${voParam}`).then((r) => r.json());
    if (calc.error) return;
    setCalc(calc);
    const base = calc.baseAmount || 0;
    const unpaidIds = (calc.workOrders || []).filter((r: any) => !r.isPaid && !r.isPendingApproval).map((r: any) => r._id);
    setForm((f) => ({
      ...f,
      baseAmount: base,
      totalPayable: base + f.addDeductAmount,
      vendorWorkOrderIds: selectedIds ?? unpaidIds,
    }));
  };

  const onVendorChange = (id: string) => {
    setForm((f) => ({ ...f, vendorId: id }));
    if (id && form.month) loadCalculation(id, form.month);
  };

  const onMonthChange = () => {
    if (form.vendorId && form.month) loadCalculation(form.vendorId, form.month);
  };

  const totalPayable = form.baseAmount + form.addDeductAmount;
  const remaining = totalPayable - form.paymentAmount;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/vendor-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          totalPayable: form.baseAmount + form.addDeductAmount,
          remainingAmount: remaining,
          carriedForward: remaining > 0 ? remaining : 0,
          carriedForwardRemarks: remaining > 0 ? 'Carried forward' : '',
          vendorWorkOrderIds: form.paymentType === 'monthly' ? form.vendorWorkOrderIds : [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('saveSuccess'));
      await mutate();
      setModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
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
    if (q) {
      const name = (p.vendor as { name?: string })?.name || '';
      if (!name.toLowerCase().includes(q)) return false;
    }
    return true;
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
        <PageHeader title={`${t('payments')} — ${t('vendors')}`}>
          <Skeleton className="h-10 w-24" variant="rect" />
        </PageHeader>
        <PageLoader mode="table" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={`${t('payments')} — ${t('vendors')}`}>
        <div className="flex gap-2">
          {canAdd && (
            <>
              <button
                onClick={openAdvanceModal}
                disabled={!Array.isArray(vendors) || vendors.length === 0}
                className="px-4 py-2 rounded-lg border border-uff-accent text-uff-accent hover:bg-uff-accent/10 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('advancePayment')}
              </button>
              <button
                onClick={openAdd}
                disabled={!Array.isArray(vendors) || vendors.length === 0}
                className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('add')} {t('payment')}
              </button>
            </>
          )}
        </div>
      </PageHeader>

      <ListToolbar search={search} onSearchChange={setSearch} sortBy={sortBy} onSortChange={setSortBy} sortOptions={SORT_OPTIONS} viewMode={viewMode} onViewModeChange={setViewMode} searchPlaceholder={t('search')}>
        <div className="flex flex-wrap gap-3 items-center">
          <SearchableSelect
            label={t('vendor')}
            options={[{ _id: '', name: t('all') }, ...(Array.isArray(vendors) ? vendors : [])]}
            value={filterVendor}
            onChange={setFilterVendor}
            className="min-w-[180px]"
          />
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('month')}</label>
            <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('payment')}</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as 'all' | 'advance' | 'monthly')} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white">
              <option value="all">{t('all')}</option>
              <option value="advance">{t('advancePayment')}</option>
              <option value="monthly">{t('monthlyPayment')}</option>
            </select>
          </div>
        </div>
      </ListToolbar>

      <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('vendor')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('month')}</th>
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
                  <tr key={(p as { _id: string })._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-800">{(p.vendor as { name?: string })?.name}</td>
                    <td className="px-4 py-3 text-slate-600 text-sm">{formatMonth((p as { month?: string }).month)}</td>
                    <td className="px-4 py-3 text-right">₹{formatAmount((p as { totalPayable?: number }).totalPayable)}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{formatAmount((p as { paymentAmount?: number }).paymentAmount)}</td>
                    <td className="px-4 py-3 text-slate-800">{formatMode((p as { paymentMode?: string }).paymentMode || '')}</td>
                    <td className="px-4 py-3">
                      {(p as { paymentType?: string }).paymentType === 'advance' ? (
                        <span className="text-blue-600 text-sm">{t('advance')}</span>
                      ) : ((p as { remainingAmount?: number }).remainingAmount ?? 0) > 0 ? (
                        <span className="text-uff-accent text-sm">₹{formatAmount((p as { remainingAmount?: number }).remainingAmount ?? 0)} {t('due')}</span>
                      ) : (
                        <span className="text-green-600 text-sm">{t('paid')}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDetailPayment(p)} className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium text-sm hover:bg-slate-100 transition">
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

      {sorted.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
          {hasMore && (
            <button onClick={() => setPage((p) => p + 1)} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium">
              {t('loadMore')}
            </button>
          )}
        </div>
      )}

      {/* Add Payment Modal */}
      <Modal open={!!(modal && canAdd)} onClose={() => setModal(false)} title={`${t('add')} ${t('payment')}`} size="2xl" footer={
        <div className="flex gap-3 justify-end">
          <button onClick={() => setModal(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
            {t('cancel')}
          </button>
          <button onClick={handleSubmit} disabled={saving || !form.vendorId || !form.month || !form.paymentAmount} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition">
            {saving ? '...' : t('save')}
          </button>
        </div>
      }>
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label={t('vendor')}
              options={vendors || []}
              value={form.vendorId}
              onChange={onVendorChange}
              required
            />
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('month')} *</label>
              <input type="month" value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))} onBlur={onMonthChange} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <button type="button" onClick={() => form.vendorId && onMonthChange()} className="text-sm font-medium text-uff-accent hover:text-uff-accent-hover">
            {t('calculate')}
          </button>
          {calc?.workOrders && calc.workOrders.length > 0 && (
            <div className="p-4 bg-slate-50 rounded-xl space-y-2">
              <p className="text-sm font-medium text-slate-800">{t('workOrders')} – {t('selectPaymentAgainst')}</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {(calc.workOrders as any[]).map((wo) => {
                  const isPaid = wo.isPaid || !!wo.paymentId;
                  const isPendingApproval = wo.isPendingApproval ?? false;
                  const isDisabled = isPaid || isPendingApproval;
                  const isSelected = form.vendorWorkOrderIds.includes(wo._id);
                  const statusLabel = isPaid ? ` (${t('paid')})` : isPendingApproval ? ` (${t('awaitingApproval')})` : '';
                  return (
                    <label key={wo._id} className={`flex items-start gap-3 p-2 rounded-lg border cursor-pointer ${isDisabled ? 'bg-slate-100 border-slate-200 opacity-75' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isDisabled}
                        onChange={() => {
                          if (isDisabled) return;
                          const next = isSelected ? form.vendorWorkOrderIds.filter((id) => id !== wo._id) : [...form.vendorWorkOrderIds, wo._id];
                          setForm((f) => ({ ...f, vendorWorkOrderIds: next }));
                          loadCalculation(form.vendorId, form.month, next);
                        }}
                        className="mt-1 rounded border-slate-300 text-uff-accent disabled:opacity-50"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">
                          {(wo.branch as { name?: string })?.name || t('workRecord')}
                          {wo.styleOrder ? ` – ${wo.styleOrder.styleCode}` : ''}
                          {statusLabel}
                        </p>
                        {((wo.workItems || []).map((item: any, i: number) => (
                          <p key={i} className="text-slate-600 text-xs ml-2">{item.rateName}: {item.quantity} × ₹{formatAmount(item.ratePerUnit)} = ₹{formatAmount(item.amount)}</p>
                        )))}
                        <p className="text-slate-800 font-medium mt-0.5">₹{formatAmount(wo.totalAmount || 0)}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-sm text-slate-800">{t('baseAmount')}: ₹{formatAmount(form.baseAmount)}</p>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('addDeduct')} (₹)</label>
              <ValidatedInput type="text" inputMode="decimal" value={form.addDeductAmount ? String(form.addDeductAmount) : ''} onChange={(v) => setForm((f) => ({ ...f, addDeductAmount: parseFloat(v) || 0 }))} fieldType="number" validate={(v) => v.trim() === '' || !isNaN(parseFloat(v))} className="w-full px-3 py-2.5" />
            </div>
          </div>
          <div className="p-4 bg-uff-accent/5 rounded-xl border border-uff-accent/20">
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('totalPayable')}</label>
            <p className="text-2xl font-bold text-slate-900">₹{formatAmount(form.baseAmount + form.addDeductAmount)}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('paymentAmount')} (₹) *</label>
              <ValidatedInput type="text" inputMode="decimal" value={form.paymentAmount ? String(form.paymentAmount) : ''} onChange={(v) => setForm((f) => ({ ...f, paymentAmount: parseFloat(v) || 0 }))} fieldType="number" placeholderHint="e.g. 5000" className="w-full px-3 py-2.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('paymentMode')} *</label>
              <select value={form.paymentMode} onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('transactionRef')}</label>
            <ValidatedInput type="text" value={form.transactionRef} onChange={(v) => setForm((f) => ({ ...f, transactionRef: v }))} fieldType="text" placeholderHint="Cheque no, ref..." className="w-full px-3 py-2.5" />
          </div>
        </div>
      </Modal>

      {/* Advance Modal */}
      <Modal open={!!(advanceModal && canAdd)} onClose={() => setAdvanceModal(false)} title={t('advancePayment')} size="lg" footer={
        <div className="flex gap-3 justify-end">
          <button onClick={() => setAdvanceModal(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
            {t('cancel')}
          </button>
          <button onClick={handleAdvanceSubmit} disabled={saving || !advanceForm.vendorId || !advanceForm.amount || advanceForm.amount <= 0} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition">
            {saving ? '...' : t('save')}
          </button>
        </div>
      }>
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <SearchableSelect
              label={t('vendor')}
              options={vendors || []}
              value={advanceForm.vendorId}
              onChange={(val: string) => setAdvanceForm((f) => ({ ...f, vendorId: val }))}
              required
            />
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('month')} *</label>
              <input type="month" value={advanceForm.month} onChange={(e) => setAdvanceForm((f) => ({ ...f, month: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('amount')} (₹) *</label>
            <ValidatedInput type="text" inputMode="decimal" value={advanceForm.amount ? String(advanceForm.amount) : ''} onChange={(v) => setAdvanceForm((f) => ({ ...f, amount: parseFloat(v) || 0 }))} placeholderHint="e.g. 5000" fieldType="number" validate={(v) => v.trim() === '' || !isNaN(parseFloat(v))} className="w-full px-3 py-2.5" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('reasons')}</label>
            <ValidatedInput type="text" value={advanceForm.remarks} onChange={(v) => setAdvanceForm((f) => ({ ...f, remarks: v }))} fieldType="text" placeholderHint="Optional" className="w-full px-3 py-2.5" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('paymentMode')} *</label>
              <select value={advanceForm.paymentMode} onChange={(e) => setAdvanceForm((f) => ({ ...f, paymentMode: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('transactionRef')}</label>
              <ValidatedInput type="text" value={advanceForm.transactionRef} onChange={(v) => setAdvanceForm((f) => ({ ...f, transactionRef: v }))} fieldType="text" placeholderHint="Optional" className="w-full px-3 py-2.5" />
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailPayment} onClose={() => setDetailPayment(null)} title={t('paymentDetails')} size="lg" footer={
        <button onClick={() => setDetailPayment(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
          {t('close')}
        </button>
      }>
        {detailPayment && (
          <div className="space-y-3 text-sm">
            <p><span className="font-medium text-slate-700">{t('vendor')}:</span> {(detailPayment as { vendor?: { name?: string } }).vendor?.name}</p>
            <p><span className="font-medium text-slate-700">{t('month')}:</span> {formatMonth((detailPayment as { month?: string }).month)}</p>
            <p><span className="font-medium text-slate-700">{t('baseAmount')}:</span> ₹{formatAmount((detailPayment as { baseAmount?: number }).baseAmount)}</p>
            <p><span className="font-medium text-slate-700">{t('totalPayable')}:</span> ₹{formatAmount((detailPayment as { totalPayable?: number }).totalPayable)}</p>
            <p><span className="font-medium text-slate-700">{t('paymentAmount')}:</span> ₹{formatAmount((detailPayment as { paymentAmount?: number }).paymentAmount)}</p>
            <p><span className="font-medium text-slate-700">{t('paymentMode')}:</span> {formatMode(detailPayment.paymentMode || '')}</p>
            {(detailPayment as { paymentType?: string }).paymentType === 'advance' && <p className="text-blue-600">{t('advance')}</p>}
          </div>
        )}
      </Modal>

      <SaveOverlay show={saving} label={t('saving')} />
    </div>
  );
}
