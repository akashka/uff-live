'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import ActionButtons from '@/components/ActionButtons';

interface Branch {
  _id: string;
  name: string;
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
  branchRates: BranchRate[];
  isActive: boolean;
}

export default function RatesPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const [rates, setRates] = useState<RateMaster[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    unit: 'per piece',
    sameForAll: true,
    amountForAll: 0,
    branchRates: [] as { branch: string; amount: number }[],
  });
  const [importing, setImporting] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importMode, setImportMode] = useState<'add' | 'replace'>('add');

  const fetchRates = () => {
    fetch(`/api/rates?includeInactive=${includeInactive}`)
      .then((r) => r.json())
      .then((data) => setRates(Array.isArray(data) ? data : []))
      .catch(() => setMessage({ type: 'error', text: t('error') }));
  };

  useEffect(() => {
    setLoading(true);
    fetchRates();
    fetch('/api/branches?includeInactive=false')
      .then((r) => r.json())
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => {});
    setLoading(false);
  }, [includeInactive]);

  const openCreate = () => {
    if (!Array.isArray(branches) || branches.length === 0) {
      setMessage({ type: 'error', text: t('addBranchFirst') });
      return;
    }
    setForm({
      name: '',
      description: '',
      unit: 'per piece',
      sameForAll: true,
      amountForAll: 0,
      branchRates: (Array.isArray(branches) ? branches : []).map((b) => ({ branch: b._id, amount: 0 })) || [],
    });
    setModal('create');
    setEditingId(null);
  };

  const openEdit = (r: RateMaster) => {
    if (!Array.isArray(branches) || branches.length === 0) return;
    const branchRates = (branches as { _id: string }[]).map((b) => {
      const existing = r.branchRates?.find(
        (br) => (typeof br.branch === 'object' ? br.branch._id : br.branch) === b._id
      );
      return { branch: b._id, amount: existing?.amount ?? 0 };
    });
    const allSame = branchRates.length > 0 && branchRates.every((br) => br.amount === branchRates[0].amount);
    setForm({
      name: r.name,
      description: r.description || '',
      unit: r.unit || 'per piece',
      sameForAll: allSame,
      amountForAll: allSame && branchRates[0] ? branchRates[0].amount : 0,
      branchRates,
    });
    setModal('edit');
    setEditingId(r._id);
  };

  const openView = (r: RateMaster) => {
    if (!Array.isArray(branches) || branches.length === 0) return;
    const branchRates = (branches as { _id: string }[]).map((b) => {
      const existing = r.branchRates?.find(
        (br) => (typeof br.branch === 'object' ? br.branch._id : br.branch) === b._id
      );
      return { branch: b._id, amount: existing?.amount ?? 0 };
    });
    const allSame = branchRates.length > 0 && branchRates.every((br) => br.amount === branchRates[0].amount);
    setForm({
      name: r.name,
      description: r.description || '',
      unit: r.unit || 'per piece',
      sameForAll: allSame,
      amountForAll: allSame && branchRates[0] ? branchRates[0].amount : 0,
      branchRates,
    });
    setModal('view');
    setEditingId(r._id);
  };

  const handleSameForAllChange = (checked: boolean) => {
    setForm((f) => ({
      ...f,
      sameForAll: checked,
      ...(checked && f.branchRates.length > 0
        ? { amountForAll: f.branchRates[0]?.amount ?? 0 }
        : {}),
    }));
  };

  const applyAmountToAll = () => {
    const amt = form.amountForAll;
    setForm((f) => ({
      ...f,
      branchRates: f.branchRates.map((br) => ({ ...br, amount: amt })),
    }));
  };

  const updateBranchAmount = (branchId: string, amount: number) => {
    setForm((f) => ({
      ...f,
      branchRates: f.branchRates.map((br) => (br.branch === branchId ? { ...br, amount } : br)),
    }));
  };

  const getBranchRatesPayload = () => {
    if (!Array.isArray(branches) || branches.length === 0) return [];
    if (form.sameForAll) {
      return (Array.isArray(branches) ? branches : []).map((b) => ({ branch: b._id, amount: form.amountForAll }));
    }
    return form.branchRates.filter((br) => br.amount >= 0);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const branchRates = getBranchRatesPayload();
      if (branchRates.length === 0 || branches.length === 0) {
        setMessage({ type: 'error', text: t('addBranchFirst') });
        setSaving(false);
        return;
      }

      if (modal === 'create') {
        const res = await fetch('/api/rates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, description: form.description, unit: form.unit, branchRates }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        setMessage({ type: 'success', text: t('saveSuccess') });
        setModal(null);
        fetchRates();
      } else if (editingId) {
        const res = await fetch(`/api/rates/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, description: form.description, unit: form.unit, branchRates }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setMessage({ type: 'success', text: t('saveSuccess') });
        setModal(null);
        fetchRates();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('error') });
    } finally {
      setSaving(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append('file', importFile);
      fd.append('mode', importMode);
      const res = await fetch('/api/rates/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      setMessage({
        type: 'success',
        text: `${t('saveSuccess')} ${data.created} ${t('rate')} imported${data.skipped ? `, ${data.skipped} skipped (duplicates)` : ''}`,
      });
      setImportModal(false);
      setImportFile(null);
      fetchRates();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('error') });
    } finally {
      setImporting(false);
    }
  };

  const handleToggleActive = async (r: RateMaster) => {
    try {
      await fetch(`/api/rates/${r._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !r.isActive }),
      });
      fetchRates();
    } catch {
      setMessage({ type: 'error', text: t('error') });
    }
  };

  const formatRate = (r: RateMaster) => {
    const rates = r.branchRates || [];
    if (rates.length === 0) return '-';
    const amounts = rates.map((br) => br.amount);
    const allSame = amounts.every((a) => a === amounts[0]);
    if (allSame) return `₹${amounts[0]} ${r.unit}`;
    return rates.map((br) => {
      const branchName = typeof br.branch === 'object' ? (br.branch as Branch).name : '-';
      return `${branchName}: ₹${br.amount}`;
    }).join(' | ');
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
      <div className="flex justify-center py-12">
        <div className="animate-spin w-10 h-10 border-4 border-uff-accent border-t-transparent rounded-full" />
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

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
        >
          {message.text}
        </div>
      )}

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

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 my-8">
            <h2 className="text-lg font-semibold mb-4">
              {modal === 'view' ? t('view') : modal === 'create' ? t('create') : t('edit')} {t('rate')}
            </h2>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('rateName')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  readOnly={modal === 'view'}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                  placeholder="e.g. Stitching jeans"
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
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('unit')}</label>
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

              <div className="border-t border-slate-200 pt-4">
                {(!Array.isArray(branches) || branches.length === 0) && (
                  <p className="text-uff-accent text-sm mb-3">{t('addBranchFirst')}</p>
                )}
                {modal !== 'view' && (
                  <label className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      checked={form.sameForAll}
                      onChange={(e) => handleSameForAllChange(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium text-slate-800">{t('sameForAllBranches')}</span>
                  </label>
                )}

                {form.sameForAll ? (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">{t('amount')} (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.amountForAll || ''}
                        onChange={(e) => setForm((f) => ({ ...f, amountForAll: parseFloat(e.target.value) || 0 }))}
                        readOnly={modal === 'view'}
                        className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                        placeholder="10"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {modal !== 'view' && (
                      <div className="flex flex-wrap items-center gap-2 p-2 bg-uff-surface rounded-lg">
                        <span className="text-sm font-medium text-slate-800">{t('enterPerBranch')}</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          id="apply-amount"
                          className="w-20 px-2 py-1 border border-slate-300 rounded text-sm"
                          placeholder="0"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const input = document.getElementById('apply-amount') as HTMLInputElement;
                            const amt = parseFloat(input?.value || '0') || 0;
                            if (amt >= 0) {
                              setForm((f) => ({
                                ...f,
                                amountForAll: amt,
                                branchRates: f.branchRates.map((br) => ({ ...br, amount: amt })),
                              }));
                            }
                          }}
                          className="text-sm text-uff-accent hover:text-uff-accent-hover font-medium"
                        >
                          {t('applyToAll')}
                        </button>
                      </div>
                    )}
                    {(Array.isArray(branches) ? branches : []).map((b) => (
                      <div key={b._id} className="flex items-center gap-2">
                        <span className="text-sm text-slate-600 w-32 truncate">{b.name}</span>
                        <input
                          type="number"
                          min={0}
                          step={0.01}
                          value={form.branchRates.find((br) => br.branch === b._id)?.amount ?? ''}
                          onChange={(e) => updateBranchAmount(b._id, parseFloat(e.target.value) || 0)}
                          readOnly={modal === 'view'}
                          className={`flex-1 px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                          placeholder="0"
                        />
                        <span className="text-sm text-slate-700">₹</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {modal !== 'view' && (
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name || !form.unit}
                  className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50"
                >
                  {saving ? '...' : t('save')}
                </button>
              )}
              {modal === 'view' && editingId && (
                <button
                  onClick={() => setModal('edit')}
                  className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium"
                >
                  {t('edit')}
                </button>
              )}
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-uff-surface"
              >
                {modal === 'view' ? t('close') : t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {importModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold mb-4">{t('importFromExcel')}</h2>
            <p className="text-sm text-slate-600 mb-4">
              Upload an Excel file (.xls or .xlsx) with columns: SL NO, DESCRIPTION, RATE. Same format as RATE LIST.xlsx.
            </p>
            <div className="space-y-4">
              <div>
                <input
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-2">Import mode</label>
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
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleImport}
                disabled={importing || !importFile}
                className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50"
              >
                {importing ? '...' : t('importRates')}
              </button>
              <button
                onClick={() => { setImportModal(false); setImportFile(null); }}
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
