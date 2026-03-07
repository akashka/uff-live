'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import ActionButtons from '@/components/ActionButtons';
import { PageLoader, Skeleton } from '@/components/Skeleton';
import { useStyleOrders, useBranches, useRates } from '@/lib/hooks/useApi';
import ValidatedInput from '@/components/ValidatedInput';
import ConfirmModal from '@/components/ConfirmModal';
import Modal from '@/components/Modal';
import MultiselectDropdown from '@/components/MultiselectDropdown';

interface Branch {
  _id: string;
  name: string;
}

interface RateMaster {
  _id: string;
  name: string;
  unit: string;
}

interface MonthWiseData {
  month: string;
  totalOrderQuantity: number;
  sellingPricePerQuantity: number;
}

interface StyleOrder {
  _id: string;
  styleCode: string;
  details?: string;
  branches: (Branch | string)[];
  rateMasterItems: (RateMaster | string)[];
  monthWiseData: MonthWiseData[];
  isActive: boolean;
}

export default function StyleOrdersPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const { styleOrders, loading, mutate } = useStyleOrders(includeInactive, filterBranch || undefined, filterMonth || undefined);
  const { branches } = useBranches(true);
  const { rates } = useRates(true);
  const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('code-asc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => Promise<void> } | null>(null);

  const [form, setForm] = useState({
    styleCode: '',
    details: '',
    branchIds: [] as string[],
    rateMasterItems: [] as string[],
    monthWiseData: [] as { month: string; totalOrderQuantity: number; sellingPricePerQuantity: number }[],
  });

  const canAccess = ['admin', 'finance', 'hr'].includes(user?.role || '');

  useEffect(() => {
    if (Array.isArray(branches) && branches.length === 1 && !filterBranch) {
      setFilterBranch(branches[0]._id);
    }
  }, [branches, filterBranch]);

  const openCreate = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setForm({
      styleCode: '',
      details: '',
      branchIds: filterBranch ? [filterBranch] : (Array.isArray(branches) && branches[0] ? [branches[0]._id] : []),
      rateMasterItems: [],
      monthWiseData: [{ month: currentMonth, totalOrderQuantity: 0, sellingPricePerQuantity: 0 }],
    });
    setModal('create');
    setEditingId(null);
  };

  const openEdit = (s: StyleOrder) => {
    const branchIds = (s.branches || []).map((b) => (typeof b === 'object' && b._id ? b._id : String(b)));
    setForm({
      styleCode: s.styleCode,
      details: s.details || '',
      branchIds,
      rateMasterItems: (s.rateMasterItems || []).map((r) => (typeof r === 'object' ? (r as RateMaster)._id : r)),
      monthWiseData: (s.monthWiseData || []).map((m) => ({
        month: m.month,
        totalOrderQuantity: m.totalOrderQuantity ?? 0,
        sellingPricePerQuantity: m.sellingPricePerQuantity ?? 0,
      })),
    });
    setModal('edit');
    setEditingId(s._id);
  };

  const openView = (s: StyleOrder) => {
    openEdit(s);
    setModal('view');
  };

  const addMonth = () => {
    const lastMonth = form.monthWiseData[form.monthWiseData.length - 1]?.month || '';
    let nextMonth = lastMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    if (lastMonth) {
      const [y, m] = lastMonth.split('-').map(Number);
      const d = new Date(y, m, 1);
      d.setMonth(d.getMonth() + 1);
      nextMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    setForm((f) => ({ ...f, monthWiseData: [...f.monthWiseData, { month: nextMonth, totalOrderQuantity: 0, sellingPricePerQuantity: 0 }] }));
  };

  const updateMonthData = (monthIdx: number, field: 'month' | 'totalOrderQuantity' | 'sellingPricePerQuantity', value: string | number) => {
    setForm((f) => {
      const m = [...f.monthWiseData];
      if (!m[monthIdx]) return f;
      m[monthIdx] = { ...m[monthIdx], [field]: value };
      return { ...f, monthWiseData: m };
    });
  };

  const updateMonthCostFromPerPiece = (monthIdx: number, perPiece: number) => {
    setForm((f) => {
      const m = [...f.monthWiseData];
      if (!m[monthIdx]) return f;
      m[monthIdx] = { ...m[monthIdx], sellingPricePerQuantity: perPiece };
      return { ...f, monthWiseData: m };
    });
  };

  const updateMonthCostFromTotal = (monthIdx: number, total: number) => {
    setForm((f) => {
      const m = [...f.monthWiseData];
      if (!m[monthIdx]) return f;
      const qty = m[monthIdx].totalOrderQuantity || 0;
      const perPiece = qty > 0 ? total / qty : 0;
      m[monthIdx] = { ...m[monthIdx], sellingPricePerQuantity: perPiece };
      return { ...f, monthWiseData: m };
    });
  };

  const removeMonth = (monthIdx: number) => {
    setForm((f) => ({ ...f, monthWiseData: f.monthWiseData.filter((_, i) => i !== monthIdx) }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload = {
        styleCode: form.styleCode.trim(),
        details: form.details,
        branches: form.branchIds,
        rateMasterItems: form.rateMasterItems,
        monthWiseData: form.monthWiseData
          .filter((m) => m.month && (m.totalOrderQuantity > 0 || m.sellingPricePerQuantity > 0))
          .map((m) => ({
            month: m.month.slice(0, 7),
            totalOrderQuantity: Math.max(0, m.totalOrderQuantity),
            sellingPricePerQuantity: Math.max(0, m.sellingPricePerQuantity),
          })),
      };

      if (modal === 'create') {
        const res = await fetch('/api/style-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        setMessage({ type: 'success', text: t('saveSuccess') });
        setModal(null);
        mutate();
      } else if (editingId) {
        const res = await fetch(`/api/style-orders/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        setMessage({ type: 'success', text: t('saveSuccess') });
        setModal(null);
        mutate();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('error') });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = (s: StyleOrder) => {
    setConfirmModal({
      message: s.isActive ? t('confirmMakeInactive') : t('confirmMakeActive'),
      confirmLabel: s.isActive ? t('makeInactive') : t('makeActive'),
      variant: 'warning',
      onConfirm: async () => {
        const res = await fetch(`/api/style-orders/${s._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !s.isActive }),
        });
        if (!res.ok) throw new Error();
        mutate();
      },
    });
  };

  const getBranchNames = (s: StyleOrder) => {
    const brs = (s.branches || []) as (Branch | string)[];
    return brs.map((b) => (typeof b === 'object' && b.name ? b.name : '')).filter(Boolean).join(', ') || '-';
  };

  const getRateName = (id: string) => (Array.isArray(rates) ? rates.find((r) => r._id === id) : null)?.name || id;

  const filtered = (Array.isArray(styleOrders) ? styleOrders : []).filter((s) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const branchNames = getBranchNames(s);
    return s.styleCode.toLowerCase().includes(q) || (s.details || '').toLowerCase().includes(q) || branchNames.toLowerCase().includes(q);
  });
  const sorted = [...filtered].sort((a, b) =>
    sortBy === 'code-desc' ? b.styleCode.localeCompare(a.styleCode) : a.styleCode.localeCompare(b.styleCode)
  );
  const SORT_OPTIONS = [
    { value: 'code-asc', label: `${t('styleOrderCode')} (A-Z)` },
    { value: 'code-desc', label: `${t('styleOrderCode')} (Z-A)` },
  ];

  if (!canAccess) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <p className="text-slate-700">{t('accessDenied')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={t('styleOrders')}>
          <Skeleton className="h-10 w-24" variant="rect" />
        </PageHeader>
        <PageLoader mode="table" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('styleOrders')}>
        <button
          onClick={openCreate}
          disabled={!Array.isArray(branches) || branches.length === 0}
          className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          title={!Array.isArray(branches) || branches.length === 0 ? t('addBranchFirst') : ''}
        >
          {t('add')} {t('styleOrder')}
        </button>
      </PageHeader>

      {message && (
        <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {message.text}
        </div>
      )}

      <ListToolbar search={search} onSearchChange={setSearch} sortBy={sortBy} onSortChange={setSortBy} sortOptions={SORT_OPTIONS} viewMode={viewMode} onViewModeChange={setViewMode} searchPlaceholder={t('search')}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="rounded border-slate-400" />
          <span className="text-sm text-slate-800">{t('inactive')}</span>
        </label>
        <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm">
          <option value="">{t('all')} {t('branches')}</option>
          {(Array.isArray(branches) ? branches : []).map((b) => (
            <option key={b._id} value={b._id}>{b.name}</option>
          ))}
        </select>
        <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Month" />
      </ListToolbar>

      {viewMode === 'table' ? (
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-uff-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('styleOrderCode')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('details')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('branches')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('rateMaster')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('status')}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-600">{t('noData')}</td>
                  </tr>
                ) : (
                  sorted.map((s) => (
                    <tr key={s._id} className="hover:bg-uff-surface">
                      <td className="px-4 py-3 font-medium text-slate-900">{s.styleCode}</td>
                      <td className="px-4 py-3 text-slate-700 max-w-[200px] truncate">{s.details || '–'}</td>
                      <td className="px-4 py-3 text-slate-700">{getBranchNames(s)}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {(s.rateMasterItems || [])
                          .map((r: RateMaster | string) => (typeof r === 'object' ? (r as RateMaster).name : getRateName(r)))
                          .join(', ') || '–'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                          {s.isActive ? t('active') : t('inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => openView(s)}
                          onEdit={() => openEdit(s)}
                          onToggleActive={() => handleToggleActive(s)}
                          isActive={s.isActive}
                          viewLabel={t('view')}
                          editLabel={t('edit')}
                          toggleLabel={s.isActive ? t('makeInactive') : t('makeActive')}
                        />
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
            sorted.map((s) => (
              <div key={s._id} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                <h3 className="font-semibold text-slate-900">{s.styleCode}</h3>
                <p className="text-sm text-slate-600 mt-1 line-clamp-2">{s.details || '–'}</p>
                <p className="text-sm text-slate-700 mt-1">{getBranchNames(s)}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {(s.rateMasterItems || []).map((r: RateMaster | string) => (typeof r === 'object' ? (r as RateMaster).name : getRateName(r))).join(', ') || '–'}
                </p>
                <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                  {s.isActive ? t('active') : t('inactive')}
                </span>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <ActionButtons
                    onView={() => openView(s)}
                    onEdit={() => openEdit(s)}
                    onToggleActive={() => handleToggleActive(s)}
                    isActive={s.isActive}
                    viewLabel={t('view')}
                    editLabel={t('edit')}
                    toggleLabel={s.isActive ? t('makeInactive') : t('makeActive')}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={`${modal === 'view' ? t('view') : modal === 'create' ? t('create') : t('edit')} ${t('styleOrder')}`}
        size="2xl"
        footer={
          <div className="flex gap-3 justify-end">
            {modal !== 'view' && (
              <button onClick={handleSave} disabled={saving || !form.styleCode.trim() || form.branchIds.length === 0 || form.rateMasterItems.length === 0} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition">
                {saving ? '...' : t('save')}
              </button>
            )}
            {modal === 'view' && editingId && (
              <button onClick={() => setModal('edit')} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium transition">
                {t('edit')}
              </button>
            )}
            <button onClick={() => setModal(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
              {modal === 'view' ? t('close') : t('cancel')}
            </button>
          </div>
        }
      >
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('styleOrderCode')} <span className="text-red-500">*</span></label>
                  <ValidatedInput
                    type="text"
                    value={form.styleCode}
                    onChange={(v) => setForm((f) => ({ ...f, styleCode: v }))}
                    fieldType="name"
                    readOnly={modal === 'view'}
                    className="w-full px-3 py-2"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-2">Select branches where this style is produced (e.g. stitching at one, cutting at another)</p>
                <MultiselectDropdown
                  options={Array.isArray(branches) ? branches : []}
                  selectedIds={form.branchIds}
                  onChange={(ids) => setForm((f) => ({ ...f, branchIds: ids }))}
                  placeholder={t('selectBranches')}
                  label={t('branches')}
                  required
                  disabled={modal === 'view'}
                  selectAllLabel={t('selectAll')}
                  searchPlaceholder={t('search')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('details')}</label>
                <textarea
                  value={form.details}
                  onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                  readOnly={modal === 'view'}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50' : ''}`}
                  rows={2}
                />
              </div>
              <div>
                <p className="text-xs text-slate-600 mb-2">Select rate masters associated with this style (required)</p>
                <MultiselectDropdown
                  options={Array.isArray(rates) ? rates : []}
                  selectedIds={form.rateMasterItems}
                  onChange={(ids) => setForm((f) => ({ ...f, rateMasterItems: ids }))}
                  placeholder={`${t('rateMaster')} ${t('items')}`}
                  label={`${t('rateMaster')} ${t('items')}`}
                  required
                  disabled={modal === 'view'}
                  showUnit
                  selectAllLabel={t('selectAll')}
                  searchPlaceholder={t('search')}
                />
              </div>

              <div className="border-t border-slate-200 pt-4">
                <div className="flex justify-between items-center mb-3">
                  <label className="block text-sm font-medium text-slate-800">{t('monthWiseData')}</label>
                  {modal !== 'view' && (
                    <button type="button" onClick={addMonth} className="text-sm text-uff-accent hover:text-uff-accent-hover font-medium">
                      + {t('add')} {t('month')}
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-600 mb-2">{t('orderQuantityAndCost')}</p>
                <div className="space-y-4">
                  {form.monthWiseData.map((m, monthIdx) => {
                    const qty = m.totalOrderQuantity || 0;
                    const perPiece = m.sellingPricePerQuantity ?? 0;
                    const totalCost = qty > 0 ? perPiece * qty : 0;
                    return (
                    <div key={monthIdx} className="p-3 bg-uff-surface rounded-lg flex flex-wrap gap-3 items-center">
                      <input
                        type="month"
                        value={m.month}
                        onChange={(e) => updateMonthData(monthIdx, 'month', e.target.value)}
                        readOnly={modal === 'view'}
                        className="px-2 py-1 border border-slate-300 rounded text-sm"
                      />
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-slate-600">{t('quantityShort')}:</label>
                        <input
                          type="number"
                          min={0}
                          value={m.totalOrderQuantity || ''}
                          onChange={(e) => updateMonthData(monthIdx, 'totalOrderQuantity', parseFloat(e.target.value) || 0)}
                          readOnly={modal === 'view'}
                          className="w-24 px-2 py-1 border border-slate-300 rounded text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-slate-600">{t('perPiece')} ₹:</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={perPiece > 0 ? perPiece : ''}
                          onChange={(e) => updateMonthCostFromPerPiece(monthIdx, parseFloat(e.target.value) || 0)}
                          readOnly={modal === 'view'}
                          className="w-24 px-2 py-1 border border-slate-300 rounded text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-slate-600">{t('totalAmount')} ₹:</label>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={totalCost > 0 ? totalCost : ''}
                          onChange={(e) => updateMonthCostFromTotal(monthIdx, parseFloat(e.target.value) || 0)}
                          readOnly={modal === 'view'}
                          className="w-28 px-2 py-1 border border-slate-300 rounded text-sm"
                          placeholder="0"
                        />
                      </div>
                      {modal !== 'view' && (
                        <button type="button" onClick={() => removeMonth(monthIdx)} className="text-red-600 text-sm">×</button>
                      )}
                    </div>
                  );})}
                </div>
              </div>
            </div>
      </Modal>

      {confirmModal && (
        <ConfirmModal
          open={!!confirmModal}
          message={confirmModal.message}
          confirmLabel={confirmModal.confirmLabel}
          cancelLabel={t('cancel')}
          variant={confirmModal.variant}
          onConfirm={async () => {
            try {
              await confirmModal.onConfirm();
            } catch (err) {
              setMessage({ type: 'error', text: t('error') });
              throw err;
            }
          }}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
