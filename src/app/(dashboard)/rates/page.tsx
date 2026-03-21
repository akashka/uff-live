'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import ActionButtons from '@/components/ActionButtons';
import { PageLoader, Skeleton } from '@/components/Skeleton';
import { useRates, useBranches, useDepartments } from '@/lib/hooks/useApi';
import ConfirmModal from '@/components/ConfirmModal';
import SaveOverlay from '@/components/SaveOverlay';
import Modal from '@/components/Modal';
import ImportModal from '@/components/ImportModal';
import { toast } from '@/lib/toast';
import ValidatedInput from '@/components/ValidatedInput';

interface Branch {
  _id: string;
  name: string;
}

interface BranchDepartmentRate {
  branch: string | Branch;
  department: { _id: string; name: string };
  amount: number;
}

interface BranchRate {
  branch: string | Branch;
  amount: number;
}

interface RateMaster {
  _id: string;
  name: string;
  description?: string;
  unit: string;
  branchRates?: BranchRate[];
  branchDepartmentRates?: BranchDepartmentRate[];
  isActive: boolean;
}

export default function RatesPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const [includeInactive, setIncludeInactive] = useState(false);
  const { rates, loading, mutate: mutateRates } = useRates(includeInactive);
  const { branches } = useBranches(false);
  const { departments } = useDepartments(true);
  const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => Promise<void> } | null>(null);

  const [form, setForm] = useState({
    branchId: '',
    branchName: '',
    departmentId: '',
    departmentName: '',
    name: '',
    description: '',
    unit: 'per piece',
    amount: 0,
  });
  const [importing, setImporting] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'add' | 'replace'>('add');


  const openCreate = () => {
    setForm({
      branchId: '',
      branchName: '',
      departmentId: '',
      departmentName: '',
      name: '',
      description: '',
      unit: 'per piece',
      amount: 0,
    });
    setModal('create');
    setEditingId(null);
  };

  const openEdit = (r: RateMaster) => {
    const bdr = r.branchDepartmentRates?.[0];
    const br = r.branchRates?.[0];
    if (bdr) {
      const branch = typeof bdr.branch === 'object' ? (bdr.branch as Branch) : null;
      const dept = bdr.department as { _id: string; name: string };
      setForm({
        branchId: branch?._id ?? (bdr.branch as string) ?? '',
        branchName: branch?.name ?? '',
        departmentId: dept?._id ?? '',
        departmentName: dept?.name ?? '',
        name: r.name,
        description: r.description || '',
        unit: r.unit || 'per piece',
        amount: bdr.amount ?? 0,
      });
    } else if (br) {
      const branch = typeof br.branch === 'object' ? (br.branch as Branch) : null;
      setForm({
        branchId: branch?._id ?? (br.branch as string) ?? '',
        branchName: branch?.name ?? '',
        departmentId: '',
        departmentName: '',
        name: r.name,
        description: r.description || '',
        unit: r.unit || 'per piece',
        amount: br.amount ?? 0,
      });
    } else {
      setForm({
        branchId: '',
        branchName: '',
        departmentId: '',
        departmentName: '',
        name: r.name,
        description: r.description || '',
        unit: r.unit || 'per piece',
        amount: 0,
      });
    }
    setModal('edit');
    setEditingId(r._id);
  };

  const openView = (r: RateMaster) => {
    openEdit(r);
    setModal('view');
  };

  const handleSave = async () => {
    if (!form.branchId || !form.departmentId) {
      toast.error(t('addBranchFirst'));
      return;
    }
    if (!form.name?.trim() || !form.unit) {
      toast.error(t('error'));
      return;
    }
    setSaving(true);
    try {
      if (modal === 'create') {
        const res = await fetch('/api/rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            unit: form.unit,
            branchId: form.branchId,
            departmentId: form.departmentId,
            amount: form.amount,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        toast.success(t('saveSuccess'));
        await mutateRates();
        setModal(null);
      } else if (editingId) {
        const res = await fetch(`/api/rates/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            description: form.description,
            unit: form.unit,
            branchId: form.branchId,
            departmentId: form.departmentId,
            amount: form.amount,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        toast.success(t('saveSuccess'));
        await mutateRates();
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
      const res = await fetch('/api/rates/import-template');
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rate_import_template.xlsx';
      a.click();
      URL.revokeObjectURL(url);
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
      fd.append('mode', importMode);
      const res = await fetch('/api/rates/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(`${t('saveSuccess')} ${data.created} ${t('rate')} imported${data.skipped ? `, ${data.skipped} skipped (duplicates)` : ''}`);
      setImportModal(false);
      setImportFile(null);
      mutateRates();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setImporting(false);
    }
  };

  const handleToggleActive = (r: RateMaster) => {
    setConfirmModal({
      message: r.isActive ? t('confirmMakeInactive') : t('confirmMakeActive'),
      confirmLabel: r.isActive ? t('makeInactive') : t('makeActive'),
      variant: 'warning',
      onConfirm: async () => {
        const res = await fetch(`/api/rates/${r._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !r.isActive }),
        });
        if (!res.ok) throw new Error();
        toast.success(t('saveSuccess'));
        mutateRates();
      },
    });
  };

  const formatRate = (r: RateMaster) => {
    const bdr = r.branchDepartmentRates || [];
    const br = r.branchRates || [];
    if (bdr.length > 0) {
      return bdr.map((e) => {
        const branchName = typeof e.branch === 'object' ? (e.branch as Branch).name : '-';
        const deptName = typeof e.department === 'object' ? (e.department as { name: string }).name : '-';
        return `${branchName} / ${deptName}: ₹${e.amount}`;
      }).join(' | ');
    }
    if (br.length > 0) {
      return br.map((e) => {
        const branchName = typeof e.branch === 'object' ? (e.branch as Branch).name : '-';
        return `${branchName}: ₹${e.amount}`;
      }).join(' | ');
    }
    return '-';
  };

  const filtered = (Array.isArray(rates) ? rates : []).filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q);
  });
  const sorted = [...filtered].sort((a, b) =>
    sortBy === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
  );
  const SORT_OPTIONS = [
    { value: 'name-asc', label: `${t('rateName')} (A-Z)` },
    { value: 'name-desc', label: `${t('rateName')} (Z-A)` },
  ];

  if (user?.role !== 'admin') {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <p className="text-slate-600">{t('accessDenied')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={t('rateMaster')}>
          <Skeleton className="h-10 w-24" variant="rect" />
        </PageHeader>
        <PageLoader mode="table" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('rateMaster')}>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setImportModal(true)} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-uff-surface font-medium">
            {t('importFromExcel')}
          </button>
          <button onClick={openCreate} disabled={!Array.isArray(branches) || branches.length === 0} className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed" title={!Array.isArray(branches) || branches.length === 0 ? t('addBranchFirst') : ''}>
            {t('add')} {t('rate')}
          </button>
        </div>
      </PageHeader>

      <ListToolbar search={search} onSearchChange={setSearch} sortBy={sortBy} onSortChange={setSortBy} sortOptions={SORT_OPTIONS} viewMode={viewMode} onViewModeChange={setViewMode} searchPlaceholder={t('search')}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="rounded border-slate-400" />
          <span className="text-sm text-slate-800">{t('inactive')}</span>
        </label>
      </ListToolbar>

      {viewMode === 'table' ? (
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('rateName')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800 hidden md:table-cell">{t('description')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('unit')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('rate')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('status')}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-700">{t('noData')}</td>
                  </tr>
                ) : (
                  sorted.map((r) => (
                    <tr key={r._id} className="hover:bg-uff-surface">
                      <td className="px-4 py-3 text-slate-800">{r.name}</td>
                      <td className="px-4 py-3 text-slate-700 text-sm hidden md:table-cell max-w-xs truncate" title={r.description}>{r.description || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{r.unit}</td>
                      <td className="px-4 py-3 text-slate-700 text-sm">{formatRate(r)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                          {r.isActive ? t('active') : t('inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons onView={() => openView(r)} onEdit={() => openEdit(r)} onToggleActive={() => handleToggleActive(r)} isActive={r.isActive} viewLabel={t('view')} editLabel={t('edit')} toggleLabel={r.isActive ? t('makeInactive') : t('makeActive')} />
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
            sorted.map((r) => (
              <div key={r._id} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                <h3 className="font-semibold text-slate-900">{r.name}</h3>
                <p className="text-sm text-slate-600 mt-1 line-clamp-2">{r.description || '-'}</p>
                <p className="text-sm text-slate-700 mt-1">{r.unit} • {formatRate(r)}</p>
                <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>{r.isActive ? t('active') : t('inactive')}</span>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <ActionButtons onView={() => openView(r)} onEdit={() => openEdit(r)} onToggleActive={() => handleToggleActive(r)} isActive={r.isActive} viewLabel={t('view')} editLabel={t('edit')} toggleLabel={r.isActive ? t('makeInactive') : t('makeActive')} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={`${modal === 'view' ? t('view') : modal === 'create' ? t('create') : t('edit')} ${t('rate')}`}
        size="xl"
        footer={
          <div className="flex gap-3 justify-end">
            {modal !== 'view' && (
              <button onClick={handleSave} disabled={saving || !form.branchId || !form.departmentId || !form.name || !form.unit} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition">
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
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('branches')} <span className="text-red-500" aria-hidden="true">*</span></label>
              {modal === 'view' ? (
                <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-800">{form.branchName || '–'}</p>
              ) : (
                <select
                  value={form.branchId}
                  onChange={(e) => {
                    const b = (branches as { _id: string; name: string }[]).find((x) => x._id === e.target.value);
                    setForm((f) => ({ ...f, branchId: e.target.value, branchName: b?.name ?? '', departmentId: '', departmentName: '' }));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                >
                  <option value="">{t('selectBranch')}...</option>
                  {(Array.isArray(branches) ? branches : []).map((b) => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('department')} <span className="text-red-500" aria-hidden="true">*</span></label>
              {modal === 'view' ? (
                <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-800">{form.departmentName || '–'}</p>
              ) : (
                <select
                  value={form.departmentId}
                  onChange={(e) => {
                    const d = (departments as { _id: string; name: string }[]).find((x) => x._id === e.target.value);
                    setForm((f) => ({ ...f, departmentId: e.target.value, departmentName: d?.name ?? '' }));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  disabled={!form.branchId}
                  required
                >
                  <option value="">{!form.branchId ? t('selectBranch') + ' first' : t('selectDepartment') + '...'}</option>
                  {(Array.isArray(departments) ? departments : []).map((d) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('rateName')} <span className="text-red-500" aria-hidden="true">*</span></label>
            <ValidatedInput
              type="text"
              value={form.name}
              onChange={(v) => setForm((f) => ({ ...f, name: v }))}
              fieldType="name"
              placeholderHint="e.g. Stitching jeans"
              readOnly={modal === 'view'}
              className="w-full px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              readOnly={modal === 'view'}
              className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
              placeholder="Optional detailed description"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('unit')} <span className="text-red-500" aria-hidden="true">*</span></label>
              <select
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                disabled={modal === 'view'}
                className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
              >
                <option value="per piece">{t('perPiece')}</option>
                <option value="per meter">{t('perMeter')}</option>
                <option value="per kg">{t('perKg')}</option>
                <option value="per dozen">{t('perDozen')}</option>
                <option value="per unit">{t('perUnit')}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('amount')} (₹) <span className="text-red-500" aria-hidden="true">*</span></label>
              <ValidatedInput
                type="text"
                inputMode="decimal"
                value={form.amount ? String(form.amount) : ''}
                onChange={(v) => setForm((f) => ({ ...f, amount: parseFloat(v) || 0 }))}
                fieldType="number"
                placeholderHint="e.g. 10"
                readOnly={modal === 'view'}
                className="w-full px-3 py-2"
              />
            </div>
          </div>
        </div>
      </Modal>

      <ImportModal
        open={importModal}
        onClose={() => { setImportModal(false); setImportFile(null); }}
        title={`${t('importFromExcel')} - ${t('rateMaster')}`}
        onDownloadTemplate={handleDownloadTemplate}
        downloadLabel={t('downloadTemplate')}
        instructions={<p>Columns: SL NO, DESCRIPTION, UNIT (dropdown), RATE. Unit dropdown: per piece, per meter, per kg, per dozen, per unit.</p>}
        file={importFile}
        onFileChange={setImportFile}
        onImport={handleImport}
        importing={importing}
        importLabel={t('importRates')}
        importModeSection={
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-2">{t('import')} mode</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input type="radio" checked={importMode === 'add'} onChange={() => setImportMode('add')} />
                <span className="text-sm">{t('addNew')}</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={importMode === 'replace'} onChange={() => setImportMode('replace')} />
                <span className="text-sm">{t('replaceExisting')}</span>
              </label>
            </div>
          </div>
        }
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
