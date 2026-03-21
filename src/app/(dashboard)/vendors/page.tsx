'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ValidatedInput from '@/components/ValidatedInput';
import ListToolbar from '@/components/ListToolbar';
import ActionButtons from '@/components/ActionButtons';
import { PageLoader, Skeleton } from '@/components/Skeleton';
import { useVendors } from '@/lib/hooks/useApi';
import ConfirmModal from '@/components/ConfirmModal';
import SaveOverlay from '@/components/SaveOverlay';
import Modal from '@/components/Modal';
import ImportModal from '@/components/ImportModal';
import { toast } from '@/lib/toast';

interface Vendor {
  _id: string;
  vendorId: string;
  name: string;
  contactNumber: string;
  email?: string;
  serviceType: string;
  address?: string;
  bankName?: string;
  accountNumber?: string;
  isActive: boolean;
}

export default function VendorsPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const canAccess = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '');
  const canAdd = ['admin', 'finance', 'hr'].includes(user?.role || '');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { vendors, total, limit, hasMore, loading, mutate } = useVendors(includeInactive, { page, limit: 50, search: search.trim() || undefined });

  const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => Promise<void> } | null>(null);
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    contactNumber: '',
    email: '',
    serviceType: '',
    address: '',
    bankName: '',
    bankBranch: '',
    ifscCode: '',
    accountNumber: '',
    upiId: '',
    panNumber: '',
    gstNumber: '',
    notes: '',
  });

  const openCreate = () => {
    setForm({
      name: '',
      contactNumber: '',
      email: '',
      serviceType: '',
      address: '',
      bankName: '',
      bankBranch: '',
      ifscCode: '',
      accountNumber: '',
      upiId: '',
      panNumber: '',
      gstNumber: '',
      notes: '',
    });
    setModal('create');
    setEditingId(null);
  };

  const openEdit = (v: Vendor) => {
    setForm({
      name: v.name,
      contactNumber: v.contactNumber,
      email: (v as { email?: string }).email || '',
      serviceType: v.serviceType,
      address: (v as { address?: string }).address || '',
      bankName: (v as { bankName?: string }).bankName || '',
      bankBranch: '',
      ifscCode: '',
      accountNumber: (v as { accountNumber?: string }).accountNumber || '',
      upiId: '',
      panNumber: '',
      gstNumber: '',
      notes: '',
    });
    setModal('edit');
    setEditingId(v._id);
  };

  const openView = (v: Vendor) => {
    openEdit(v);
    setModal('view');
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.contactNumber.trim() || !form.serviceType.trim()) {
      toast.error(t('error'));
      return;
    }
    setSaving(true);
    try {
      if (modal === 'create') {
        const res = await fetch('/api/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
      } else if (editingId) {
        const res = await fetch(`/api/vendors/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
      }
      toast.success(t('saveSuccess'));
      await mutate();
      setModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch('/api/vendors/import-template');
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vendors_import_template.xlsx';
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
      const res = await fetch('/api/vendors/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      const msg = `${data.created} ${t('vendor')} imported`;
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

  const handleToggleActive = (v: Vendor) => {
    setConfirmModal({
      message: v.isActive ? t('confirmMakeInactive') : t('confirmMakeActive'),
      confirmLabel: v.isActive ? t('makeInactive') : t('makeActive'),
      variant: 'warning',
      onConfirm: async () => {
        const res = await fetch(`/api/vendors/${v._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !v.isActive }),
        });
        if (!res.ok) throw new Error();
        toast.success(t('saveSuccess'));
        mutate();
      },
    });
  };

  if (!canAccess) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <p className="text-slate-700">{t('accessDenied')}</p>
      </div>
    );
  }

  const filtered = (Array.isArray(vendors) ? vendors : []).filter((v) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      v.name.toLowerCase().includes(q) ||
      v.vendorId?.toLowerCase().includes(q) ||
      v.contactNumber?.includes(q) ||
      v.serviceType?.toLowerCase().includes(q)
    );
  });
  const sorted = [...filtered].sort((a, b) =>
    sortBy === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
  );

  const SORT_OPTIONS = [
    { value: 'name-asc', label: `${t('vendor')} (A-Z)` },
    { value: 'name-desc', label: `${t('vendor')} (Z-A)` },
  ];

  if (loading) {
    return (
      <div>
        <PageHeader title={t('vendors')}>
          <Skeleton className="h-10 w-24" variant="rect" />
        </PageHeader>
        <PageLoader mode="table" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('vendors')}>
        <div className="flex flex-wrap gap-2">
          {canAdd && (
            <>
              <button onClick={() => setImportModal(true)} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-uff-surface font-medium">
                {t('importFromExcel')}
              </button>
              <button onClick={openCreate} className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium">
                {t('add')} {t('vendor')}
              </button>
            </>
          )}
        </div>
      </PageHeader>

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        sortBy={sortBy}
        onSortChange={setSortBy}
        sortOptions={SORT_OPTIONS}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchPlaceholder={t('search')}
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="rounded border-slate-300 text-uff-accent focus:ring-uff-accent" />
          <span className="text-sm text-slate-700">{t('includeInactive')}</span>
        </label>
      </ListToolbar>

      {viewMode === 'table' ? (
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('vendorId')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('vendor')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('serviceType')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('contactNumber')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('status')}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-600">
                      {t('noData')}
                    </td>
                  </tr>
                ) : (
                  sorted.map((v) => (
                    <tr key={v._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-700 font-mono text-sm">{v.vendorId || '-'}</td>
                      <td className="px-4 py-3 text-slate-800 font-medium">{v.name}</td>
                      <td className="px-4 py-3 text-slate-700">{v.serviceType}</td>
                      <td className="px-4 py-3 text-slate-700">{v.contactNumber}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${v.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                          {v.isActive ? t('active') : t('inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/vendors/${v._id}`}
                            className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium text-sm hover:bg-slate-100 transition"
                          >
                            {t('view')} {t('passbook')}
                          </Link>
                          <ActionButtons
                            onView={() => openView(v)}
                            onEdit={canAdd ? () => openEdit(v) : undefined}
                            onDelete={canAdd ? () => handleToggleActive(v) : undefined}
                            viewLabel={t('view')}
                            editLabel={t('edit')}
                            deleteLabel={v.isActive ? t('makeInactive') : t('makeActive')}
                          />
                        </div>
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
            sorted.map((v) => (
              <div key={v._id} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                <h3 className="font-semibold text-slate-900">{v.name}</h3>
                <p className="text-sm text-slate-600 font-mono">{v.vendorId}</p>
                <p className="text-sm text-slate-700 mt-1">{v.serviceType}</p>
                <p className="text-sm text-slate-600">{v.contactNumber}</p>
                <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${v.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                  {v.isActive ? t('active') : t('inactive')}
                </span>
                <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                  <Link href={`/vendors/${v._id}`} className="inline-flex px-3 py-1.5 rounded-lg border border-uff-accent text-uff-accent hover:bg-uff-accent/10 font-medium text-sm">
                    {t('view')} / {t('passbook')}
                  </Link>
                  {canAdd && (
                    <>
                      <button onClick={() => openEdit(v)} className="inline-flex px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium text-sm">
                        {t('edit')}
                      </button>
                      <button onClick={() => handleToggleActive(v)} className="inline-flex px-3 py-1.5 rounded-lg border border-amber-300 hover:bg-amber-50 text-amber-800 font-medium text-sm">
                        {v.isActive ? t('makeInactive') : t('makeActive')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={`${modal === 'view' ? t('view') : modal === 'create' ? t('add') : t('edit')} ${t('vendor')}`}
        size="2xl"
        footer={
          <div className="flex gap-3 justify-end">
            {modal !== 'view' && (
              <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.contactNumber.trim() || !form.serviceType.trim()} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition">
                {saving ? '...' : t('save')}
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
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('vendor')} *</label>
              <ValidatedInput
                value={form.name}
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                fieldType="text"
                placeholderHint="e.g. ABC Stitching"
                readOnly={modal === 'view'}
                className="w-full px-3 py-2.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('contactNumber')} *</label>
              <ValidatedInput
                value={form.contactNumber}
                onChange={(v) => setForm((f) => ({ ...f, contactNumber: v }))}
                fieldType="text"
                placeholderHint="e.g. +91 9876543210"
                readOnly={modal === 'view'}
                className="w-full px-3 py-2.5"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('serviceType')} *</label>
              <ValidatedInput
                value={form.serviceType}
                onChange={(v) => setForm((f) => ({ ...f, serviceType: v }))}
                fieldType="text"
                placeholderHint="e.g. Stitching, Finishing"
                readOnly={modal === 'view'}
                className="w-full px-3 py-2.5"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('email')}</label>
              <ValidatedInput
                value={form.email}
                onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                fieldType="text"
                placeholderHint="Optional"
                readOnly={modal === 'view'}
                className="w-full px-3 py-2.5"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('address')}</label>
            <ValidatedInput value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} fieldType="text" placeholderHint="Optional" readOnly={modal === 'view'} className="w-full px-3 py-2.5" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('bankName')}</label>
              <ValidatedInput value={form.bankName} onChange={(v) => setForm((f) => ({ ...f, bankName: v }))} fieldType="text" placeholderHint="Optional" readOnly={modal === 'view'} className="w-full px-3 py-2.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1">{t('accountNumber')}</label>
              <ValidatedInput value={form.accountNumber} onChange={(v) => setForm((f) => ({ ...f, accountNumber: v }))} fieldType="text" placeholderHint="Optional" readOnly={modal === 'view'} className="w-full px-3 py-2.5" />
            </div>
          </div>
        </div>
      </Modal>

      <ImportModal
        open={importModal}
        onClose={() => { setImportModal(false); setImportFile(null); }}
        title={`${t('importFromExcel')} - ${t('vendors')}`}
        onDownloadTemplate={handleDownloadTemplate}
        downloadLabel={t('downloadTemplate')}
        instructions={<p>Columns: Vendor ID, Name, Contact, Email, Service Type (dropdown), Address, Bank details, Notes. Service Type uses dropdown validation.</p>}
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
