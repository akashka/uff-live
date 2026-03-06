'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import ActionButtons from '@/components/ActionButtons';
import { PageLoader, Skeleton } from '@/components/Skeleton';

interface Branch {
  _id: string;
  name: string;
  address: string;
  phoneNumber: string;
  email?: string;
  isActive: boolean;
}

export default function BranchesPage() {
  const { t } = useApp();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phoneNumber: '', email: '' });
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchBranches = () => {
    fetch(`/api/branches?includeInactive=${includeInactive}`)
      .then((r) => r.json())
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchBranches();
  }, [includeInactive]);

  const openCreate = () => {
    setForm({ name: '', address: '', phoneNumber: '', email: '' });
    setModal('create');
    setEditingId(null);
  };

  const openEdit = (b: Branch) => {
    setForm({
      name: b.name,
      address: b.address,
      phoneNumber: b.phoneNumber,
      email: b.email || '',
    });
    setModal('edit');
    setEditingId(b._id);
  };

  const openView = (b: Branch) => {
    setForm({
      name: b.name,
      address: b.address,
      phoneNumber: b.phoneNumber,
      email: b.email || '',
    });
    setModal('view');
    setEditingId(b._id);
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (modal === 'create') {
        const res = await fetch('/api/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else if (editingId) {
        const res = await fetch(`/api/branches/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      setMessage({ type: 'success', text: t('saveSuccess') });
      setModal(null);
      fetchBranches();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('error') });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (b: Branch) => {
    try {
      await fetch(`/api/branches/${b._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !b.isActive }),
      });
      fetchBranches();
    } catch {
      setMessage({ type: 'error', text: t('error') });
    }
  };

  const filtered = (Array.isArray(branches) ? branches : []).filter((b) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q) || (b.phoneNumber || '').includes(q);
  });
  const sorted = [...filtered].sort((a, b) =>
    sortBy === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
  );
  const SORT_OPTIONS = [
    { value: 'name-asc', label: `${t('branchName')} (A-Z)` },
    { value: 'name-desc', label: `${t('branchName')} (Z-A)` },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title={t('branches')}>
          <Skeleton className="h-10 w-24" variant="rect" />
        </PageHeader>
        <PageLoader mode="table" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('branches')}>
        <button
          onClick={openCreate}
          className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium"
        >
          {t('add')} {t('branches')}
        </button>
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
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('branchName')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('address')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('phoneNumber')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('status')}</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-600">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                sorted.map((b) => (
                  <tr key={b._id} className="hover:bg-uff-surface">
                    <td className="px-4 py-3 text-slate-800">{b.name}</td>
                    <td className="px-4 py-3 text-slate-700">{b.address}</td>
                    <td className="px-4 py-3 text-slate-700">{b.phoneNumber}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                        {b.isActive ? t('active') : t('inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <ActionButtons onView={() => openView(b)} onEdit={() => openEdit(b)} onToggleActive={() => handleToggleActive(b)} isActive={b.isActive} viewLabel={t('view')} editLabel={t('edit')} toggleLabel={b.isActive ? t('makeInactive') : t('makeActive')} />
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
            sorted.map((b) => (
              <div key={b._id} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                <h3 className="font-semibold text-slate-900">{b.name}</h3>
                <p className="text-sm text-slate-600 mt-1">{b.address}</p>
                <p className="text-sm text-slate-600">{b.phoneNumber}</p>
                <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>{b.isActive ? t('active') : t('inactive')}</span>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <ActionButtons onView={() => openView(b)} onEdit={() => openEdit(b)} onToggleActive={() => handleToggleActive(b)} isActive={b.isActive} viewLabel={t('view')} editLabel={t('edit')} toggleLabel={b.isActive ? t('makeInactive') : t('makeActive')} />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold mb-4">
              {modal === 'view' ? t('view') : modal === 'create' ? t('create') : t('edit')} {t('branches')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('branchName')}</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  readOnly={modal === 'view'}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('address')}</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                  readOnly={modal === 'view'}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('phoneNumber')}</label>
                <input
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
                  readOnly={modal === 'view'}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('email')}</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  readOnly={modal === 'view'}
                  className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              {modal !== 'view' && (
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name || !form.address || !form.phoneNumber}
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
    </div>
  );
}
