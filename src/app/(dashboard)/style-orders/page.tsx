'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import ActionButtons from '@/components/ActionButtons';
import { PageLoader, Skeleton } from '@/components/Skeleton';
import { useStyleOrders, useBranches } from '@/lib/hooks/useApi';
import ValidatedInput from '@/components/ValidatedInput';
import ConfirmModal from '@/components/ConfirmModal';
import Modal from '@/components/Modal';
import { toast } from '@/lib/toast';
import MultiselectDropdown from '@/components/MultiselectDropdown';
import SaveOverlay from '@/components/SaveOverlay';
import ImportModal from '@/components/ImportModal';

interface Branch {
  _id: string;
  name: string;
}

interface StyleOrder {
  _id: string;
  styleCode: string;
  brand: string;
  colour?: string;
  details?: string;
  branches: (Branch | string)[];
  month: string;
  totalOrderQuantity: number;
  clientCostPerPiece: number;
  clientCostTotalAmount: number;
  isActive: boolean;
}

export default function StyleOrdersPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [filterMonth, setFilterMonth] = useState('');
  const { styleOrders, loading, mutate } = useStyleOrders(includeInactive, undefined, filterMonth || undefined);
  const { branches } = useBranches(true);
  const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('code-asc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => Promise<void> } | null>(null);
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState({
    brand: '',
    styleCode: '',
    colour: '',
    details: '',
    branchIds: [] as string[],
    month: '',
    totalOrderQuantity: 0,
    clientCostPerPiece: 0,
    clientCostTotalAmount: 0,
  });

  const canAccess = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '');
  const canAdd = ['admin', 'finance', 'hr'].includes(user?.role || '');

  const openCreate = () => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    setForm({
      brand: '',
      styleCode: '',
      colour: '',
      details: '',
      branchIds: [], // Create defaults to all branches in backend
      month: currentMonth,
      totalOrderQuantity: 0,
      clientCostPerPiece: 0,
      clientCostTotalAmount: 0,
    });
    setModal('create');
    setEditingId(null);
  };

  const openEdit = (s: StyleOrder) => {
    const branchIds = (s.branches || []).map((b) => (typeof b === 'object' && b._id ? b._id : String(b)));
    setForm({
      brand: s.brand || '',
      styleCode: s.styleCode,
      colour: s.colour ?? (Array.isArray((s as { colours?: string[] }).colours) ? (s as { colours?: string[] }).colours?.[0] ?? '' : ''),
      details: s.details || '',
      branchIds,
      month: s.month || '',
      totalOrderQuantity: s.totalOrderQuantity ?? 0,
      clientCostPerPiece: s.clientCostPerPiece ?? 0,
      clientCostTotalAmount: s.clientCostTotalAmount ?? 0,
    });
    setModal('edit');
    setEditingId(s._id);
  };

  const openView = (s: StyleOrder) => {
    openEdit(s);
    setModal('view');
  };

  const formatCodeInput = (v: string) => {
    return v.replace(/\D/g, '').slice(0, 4);
  };

  const getCodeForSave = () => {
    const digits = formatCodeInput(form.styleCode);
    return digits.length >= 1 && digits.length <= 4 ? digits.padStart(4, '0') : null;
  };

  const updateCostFromPerPiece = () => {
    const qty = form.totalOrderQuantity || 0;
    const perPiece = form.clientCostPerPiece || 0;
    setForm((f) => ({ ...f, clientCostTotalAmount: qty > 0 ? qty * perPiece : 0 }));
  };

  const updateCostFromTotal = () => {
    const qty = form.totalOrderQuantity || 0;
    const total = form.clientCostTotalAmount || 0;
    setForm((f) => ({ ...f, clientCostPerPiece: qty > 0 ? total / qty : 0 }));
  };

  const toNum = (v: unknown) => Math.max(0, Number(v) || 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const codeStr = getCodeForSave();
      if (!codeStr) {
        toast.error(t('styleCodeMustBe4Digits'));
        setSaving(false);
        return;
      }

      const now = new Date();
      const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthVal = form.month && String(form.month).length >= 7 ? String(form.month).slice(0, 7) : defaultMonth;
      const payload = {
        brand: String(form.brand || '').trim(),
        styleCode: codeStr,
        colour: String(form.colour || '').trim(),
        details: form.details || '',
        branches: modal === 'create' ? [] : form.branchIds, // Create: backend maps to all branches
        month: monthVal,
        totalOrderQuantity: toNum(form.totalOrderQuantity),
        clientCostPerPiece: toNum(form.clientCostPerPiece),
        clientCostTotalAmount: toNum(form.clientCostTotalAmount),
      };

      if (modal === 'create') {
        const res = await fetch('/api/style-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        toast.success(t('saveSuccess'));
        await mutate();
        setModal(null);
      } else if (editingId) {
        const { month: _m, ...editPayload } = payload;
        const res = await fetch(`/api/style-orders/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editPayload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        toast.success(t('saveSuccess'));
        await mutate();
        setModal(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/style-orders/import-template');
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'style_orders_import_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t('downloadTemplate'));
    } catch {
      toast.error(t('error'));
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      const res = await fetch('/api/style-orders/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      const msg = `${data.created} ${t('styleOrder')} imported`;
      toast.success(data.errors?.length ? `${msg} (${data.errors.length} errors)` : msg);
      setImportModal(false);
      setImportFile(null);
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setImporting(false);
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
        toast.success(t('saveSuccess'));
        await mutate();
      },
    });
  };

  const getColour = (s: StyleOrder) => s.colour ?? (Array.isArray((s as { colours?: string[] }).colours) ? (s as { colours?: string[] }).colours?.join(', ') : '') ?? '';

  const filtered = (Array.isArray(styleOrders) ? styleOrders : []).filter((s) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const colourStr = getColour(s);
    return (
      s.styleCode.toLowerCase().includes(q) ||
      (s.brand || '').toLowerCase().includes(q) ||
      (s.details || '').toLowerCase().includes(q) ||
      (colourStr || '').toLowerCase().includes(q)
    );
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'code-desc') return b.styleCode.localeCompare(a.styleCode);
    if (sortBy === 'brand-desc') return (b.brand || '').localeCompare(a.brand || '');
    if (sortBy === 'brand-asc') return (a.brand || '').localeCompare(b.brand || '');
    return a.styleCode.localeCompare(b.styleCode);
  });
  const SORT_OPTIONS = [
    { value: 'code-asc', label: `${t('styleOrderCode')} (A-Z)` },
    { value: 'code-desc', label: `${t('styleOrderCode')} (Z-A)` },
    { value: 'brand-asc', label: `${t('brand')} (A-Z)` },
    { value: 'brand-desc', label: `${t('brand')} (Z-A)` },
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
        <div className="flex flex-wrap gap-2">
          {canAdd && (
            <>
              <button
                onClick={() => setImportModal(true)}
                className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-uff-surface font-medium"
              >
                {t('importFromExcel')}
              </button>
              <button
                onClick={openCreate}
                disabled={!Array.isArray(branches) || branches.length === 0}
                className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title={!Array.isArray(branches) || branches.length === 0 ? t('addBranchFirst') : ''}
              >
                {t('add')} {t('styleOrder')}
              </button>
            </>
          )}
        </div>
      </PageHeader>

      <ListToolbar search={search} onSearchChange={setSearch} sortBy={sortBy} onSortChange={setSortBy} sortOptions={SORT_OPTIONS} viewMode={viewMode} onViewModeChange={setViewMode} searchPlaceholder={t('search')}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="rounded border-slate-400" />
          <span className="text-sm text-slate-800">{t('inactive')}</span>
        </label>
        <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm" placeholder="Month" />
      </ListToolbar>

      {viewMode === 'table' ? (
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-uff-surface">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('styleOrderCode')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('brand')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('colour')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('status')}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-600">{t('noData')}</td>
                  </tr>
                ) : (
                  sorted.map((s) => (
                    <tr key={s._id} className="hover:bg-uff-surface">
                      <td className="px-4 py-3 font-medium text-slate-900">{s.styleCode}</td>
                      <td className="px-4 py-3 text-slate-700">{s.brand || '–'}</td>
                      <td className="px-4 py-3 text-slate-700 text-sm">{getColour(s) || '–'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                          {s.isActive ? t('active') : t('inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => openView(s)}
                          onEdit={canAdd ? () => openEdit(s) : undefined}
                          onToggleActive={canAdd ? () => handleToggleActive(s) : undefined}
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
                <h3 className="font-semibold text-slate-900">{s.styleCode} {s.brand ? `— ${s.brand}` : ''}</h3>
                {getColour(s) && (
                  <p className="text-sm text-slate-600 mt-1">{t('colour')}: {getColour(s)}</p>
                )}
                <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${s.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                  {s.isActive ? t('active') : t('inactive')}
                </span>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <ActionButtons
                    onView={() => openView(s)}
                    onEdit={canAdd ? () => openEdit(s) : undefined}
                    onToggleActive={canAdd ? () => handleToggleActive(s) : undefined}
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
              <button
                onClick={handleSave}
                disabled={
                  saving ||
                  !form.styleCode.trim() ||
                  !form.brand.trim() ||
                  (modal === 'edit' && form.branchIds.length === 0) ||
                  !getCodeForSave()
                }
                className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition"
              >
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
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('brand')} <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.brand}
                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                readOnly={modal === 'view'}
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50' : ''}`}
                placeholder="e.g. Montecarlo, Puma"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('styleOrderCode')} <span className="text-red-500">*</span></label>
              <ValidatedInput
                type="text"
                value={form.styleCode}
                onChange={(v) => setForm((f) => ({ ...f, styleCode: formatCodeInput(v) || '' }))}
                validate={(v) => v === '' || /^\d{1,4}$/.test(v)}
                errorHint="Expected: 1-4 digits"
                readOnly={modal === 'view'}
                className="w-full px-3 py-2"
                placeholderHint="0001"
                maxLength={4}
                inputMode="numeric"
              />
              <p className="text-xs text-slate-500 mt-0.5">{t('styleCode4DigitHint')}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('colour')} <span className="text-slate-400 text-xs">({t('optional') || 'Optional'})</span></label>
            <p className="text-xs text-slate-500 mb-2">Select one colour for this style/order. Leave empty if not applicable. Same brand+order in a month can have different colours.</p>
            {modal === 'view' ? (
              <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg min-h-[40px]">
                {form.colour ? (
                  <span className="px-2 py-1 bg-slate-200 rounded text-sm text-slate-800">{form.colour}</span>
                ) : (
                  <span className="text-slate-500">–</span>
                )}
              </div>
            ) : (
              <input
                type="text"
                value={form.colour}
                onChange={(e) => setForm((f) => ({ ...f, colour: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                placeholder="e.g. Red, Navy, White"
              />
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('month')}</label>
              <input
                type="month"
                value={form.month}
                onChange={(e) => modal === 'create' && setForm((f) => ({ ...f, month: e.target.value }))}
                readOnly={modal === 'view' || modal === 'edit'}
                disabled={modal === 'edit'}
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg text-sm ${modal === 'view' || modal === 'edit' ? 'bg-slate-100 cursor-not-allowed' : ''}`}
              />
              {modal === 'edit' && <p className="text-xs text-slate-500 mt-0.5">{t('monthNotEditable')}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('totalPieces')}</label>
              <input
                type="number"
                min={0}
                value={form.totalOrderQuantity || ''}
                onChange={(e) => setForm((f) => ({ ...f, totalOrderQuantity: parseFloat(e.target.value) || 0 }))}
                onBlur={updateCostFromPerPiece}
                readOnly={modal === 'view'}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                placeholder="0"
              />
            </div>
          </div>

          {modal !== 'create' && (
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
          )}

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

          <div className="border-t border-slate-200 pt-4">
            <label className="block text-sm font-medium text-slate-800 mb-3">{t('clientCost')}</label>
            <p className="text-xs text-slate-600 mb-2">{t('clientCostOptionalHint')}</p>
            <div className="p-3 bg-uff-surface rounded-lg flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs text-slate-600 mb-1">{t('clientCostPerPiece')}</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.clientCostPerPiece > 0 ? form.clientCostPerPiece : ''}
                  onChange={(e) => setForm((f) => ({ ...f, clientCostPerPiece: parseFloat(e.target.value) || 0 }))}
                  onBlur={updateCostFromPerPiece}
                  readOnly={modal === 'view'}
                  className="w-28 px-2 py-1 border border-slate-300 rounded text-sm"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">{t('clientCostTotalAmount')}</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.clientCostTotalAmount > 0 ? form.clientCostTotalAmount : ''}
                  onChange={(e) => setForm((f) => ({ ...f, clientCostTotalAmount: parseFloat(e.target.value) || 0 }))}
                  onBlur={updateCostFromTotal}
                  readOnly={modal === 'view'}
                  className="w-28 px-2 py-1 border border-slate-300 rounded text-sm"
                  placeholder="0"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <ImportModal
        open={importModal}
        onClose={() => { setImportModal(false); setImportFile(null); }}
        title={`${t('importFromExcel')} - ${t('styleOrders')}`}
        onDownloadTemplate={handleDownloadTemplate}
        downloadLabel={t('downloadTemplate')}
        instructions={
          <p>Columns: Style Code (4 digits), Brand, Colour (single), Month (YYYY-MM), Total Pieces, Client Cost/Piece, Client Cost Total, Branches. Same brand+code in a month can have different colours. See &quot;Valid Values&quot; sheet for branch names.</p>
        }
        file={importFile}
        onFileChange={setImportFile}
        onImport={handleImport}
        importing={importing}
        importLabel={t('import')}
      />

      <SaveOverlay show={saving} label={t('saving')} />

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
              toast.error(t('error'));
              throw err;
            }
          }}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </div>
  );
}
