'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import PageHeader from '@/components/PageHeader';
import ValidatedInput from '@/components/ValidatedInput';
import ListToolbar from '@/components/ListToolbar';
import ActionButtons from '@/components/ActionButtons';
import { PageLoader, Skeleton } from '@/components/Skeleton';
import { useBranches } from '@/lib/hooks/useApi';
import ConfirmModal from '@/components/ConfirmModal';
import Modal from '@/components/Modal';

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
  const [includeInactive, setIncludeInactive] = useState(false);
  const { branches, loading, mutate: mutateBranches } = useBranches(includeInactive);
  const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', address: '', phoneNumber: '', email: '' });
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => Promise<void> } | null>(null);

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
      mutateBranches();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('error') });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = (b: Branch) => {
    setConfirmModal({
      message: b.isActive ? t('confirmMakeInactive') : t('confirmMakeActive'),
      confirmLabel: b.isActive ? t('makeInactive') : t('makeActive'),
      variant: 'warning',
      onConfirm: async () => {
        const res = await fetch(`/api/branches/${b._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !b.isActive }),
        });
        if (!res.ok) throw new Error();
        mutateBranches();
      },
    });
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

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={`${modal === 'view' ? t('view') : modal === 'create' ? t('create') : t('edit')} ${t('branches')}`}
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            {modal !== 'view' && (
              <button onClick={handleSave} disabled={saving || !form.name || !form.address || !form.phoneNumber} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition">
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
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('branchName')} <span className="text-red-500" aria-hidden="true">*</span></label>
                <ValidatedInput
                  type="text"
                  value={form.name}
                  onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                  fieldType="name"
                  placeholderHint="e.g. UFF Main Factory"
                  readOnly={modal === 'view'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('address')} <span className="text-red-500" aria-hidden="true">*</span></label>
                <ValidatedInput
                  type="text"
                  value={form.address}
                  onChange={(v) => setForm((f) => ({ ...f, address: v }))}
                  fieldType="address"
                  readOnly={modal === 'view'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('phoneNumber')} <span className="text-red-500" aria-hidden="true">*</span></label>
                <ValidatedInput
                  type="tel"
                  value={form.phoneNumber}
                  onChange={(v) => setForm((f) => ({ ...f, phoneNumber: v }))}
                  fieldType="phone"
                  readOnly={modal === 'view'}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('email')}</label>
                <ValidatedInput
                  type="email"
                  value={form.email}
                  onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                  fieldType="email"
                  readOnly={modal === 'view'}
                />
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
