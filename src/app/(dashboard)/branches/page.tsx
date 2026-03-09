'use client';

import React, { useState } from 'react';
import { useApp } from '@/contexts/AppContext';
import PageHeader from '@/components/PageHeader';
import ValidatedInput from '@/components/ValidatedInput';
import ListToolbar from '@/components/ListToolbar';
import ActionButtons from '@/components/ActionButtons';
import { PageLoader, Skeleton } from '@/components/Skeleton';
import { useBranches, useDepartments } from '@/lib/hooks/useApi';
import ConfirmModal from '@/components/ConfirmModal';
import SaveOverlay from '@/components/SaveOverlay';
import Modal from '@/components/Modal';
import { toast } from '@/lib/toast';
import { useSearchParams } from 'next/navigation';

interface Branch {
  _id: string;
  name: string;
  address: string;
  phoneNumber: string;
  email?: string;
  isActive: boolean;
}

interface Department {
  _id: string;
  name: string;
  description?: string;
  isActive: boolean;
}

type TabType = 'branches' | 'departments';

export default function BranchesPage() {
  const { t } = useApp();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: TabType = tabParam === 'departments' ? 'departments' : 'branches';
  const [includeInactive, setIncludeInactive] = useState(false);
  const { branches, loading: branchesLoading, mutate: mutateBranches } = useBranches(includeInactive);
  const { departments, loading: departmentsLoading, mutate: mutateDepartments } = useDepartments(includeInactive);

  // Branch state
  const [branchModal, setBranchModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [branchEditingId, setBranchEditingId] = useState<string | null>(null);
  const [branchForm, setBranchForm] = useState({ name: '', address: '', phoneNumber: '', email: '' });

  // Department state
  const [deptModal, setDeptModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [deptEditingId, setDeptEditingId] = useState<string | null>(null);
  const [deptForm, setDeptForm] = useState({ name: '', description: '' });

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{ message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => Promise<void> } | null>(null);

  const loading = activeTab === 'branches' ? branchesLoading : departmentsLoading;

  // Branch handlers
  const openBranchCreate = () => {
    setBranchForm({ name: '', address: '', phoneNumber: '', email: '' });
    setBranchModal('create');
    setBranchEditingId(null);
  };
  const openBranchEdit = (b: Branch) => {
    setBranchForm({ name: b.name, address: b.address, phoneNumber: b.phoneNumber, email: b.email || '' });
    setBranchModal('edit');
    setBranchEditingId(b._id);
  };
  const openBranchView = (b: Branch) => {
    setBranchForm({ name: b.name, address: b.address, phoneNumber: b.phoneNumber, email: b.email || '' });
    setBranchModal('view');
    setBranchEditingId(b._id);
  };
  const handleBranchSave = async () => {
    setSaving(true);
    try {
      if (branchModal === 'create') {
        const res = await fetch('/api/branches', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(branchForm),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else if (branchEditingId) {
        const res = await fetch(`/api/branches/${branchEditingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(branchForm),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      toast.success(t('saveSuccess'));
      await mutateBranches();
      setBranchModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };
  const handleBranchToggleActive = (b: Branch) => {
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
        toast.success(t('saveSuccess'));
        mutateBranches();
      },
    });
  };

  // Department handlers
  const openDeptCreate = () => {
    setDeptForm({ name: '', description: '' });
    setDeptModal('create');
    setDeptEditingId(null);
  };
  const openDeptEdit = (d: Department) => {
    setDeptForm({ name: d.name, description: d.description || '' });
    setDeptModal('edit');
    setDeptEditingId(d._id);
  };
  const openDeptView = (d: Department) => {
    setDeptForm({ name: d.name, description: d.description || '' });
    setDeptModal('view');
    setDeptEditingId(d._id);
  };
  const handleDeptSave = async () => {
    setSaving(true);
    try {
      if (deptModal === 'create') {
        const res = await fetch('/api/departments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deptForm),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      } else if (deptEditingId) {
        const res = await fetch(`/api/departments/${deptEditingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(deptForm),
        });
        if (!res.ok) throw new Error((await res.json()).error);
      }
      toast.success(t('saveSuccess'));
      await mutateDepartments();
      setDeptModal(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };
  const handleDeptToggleActive = (d: Department) => {
    setConfirmModal({
      message: d.isActive ? t('confirmMakeInactive') : t('confirmMakeActive'),
      confirmLabel: d.isActive ? t('makeInactive') : t('makeActive'),
      variant: 'warning',
      onConfirm: async () => {
        const res = await fetch(`/api/departments/${d._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !d.isActive }),
        });
        if (!res.ok) throw new Error();
        toast.success(t('saveSuccess'));
        mutateDepartments();
      },
    });
  };

  const branchFiltered = (Array.isArray(branches) ? branches : []).filter((b) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return b.name.toLowerCase().includes(q) || b.address.toLowerCase().includes(q) || (b.phoneNumber || '').includes(q);
  });
  const deptFiltered = (Array.isArray(departments) ? departments : []).filter((d) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return d.name.toLowerCase().includes(q) || (d.description || '').toLowerCase().includes(q);
  });
  const branchSorted = [...branchFiltered].sort((a, b) =>
    sortBy === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
  );
  const deptSorted = [...deptFiltered].sort((a, b) =>
    sortBy === 'name-desc' ? b.name.localeCompare(a.name) : a.name.localeCompare(b.name)
  );

  const SORT_OPTIONS_BRANCH = [
    { value: 'name-asc', label: `${t('branchName')} (A-Z)` },
    { value: 'name-desc', label: `${t('branchName')} (Z-A)` },
  ];
  const SORT_OPTIONS_DEPT = [
    { value: 'name-asc', label: `${t('departmentName')} (A-Z)` },
    { value: 'name-desc', label: `${t('departmentName')} (Z-A)` },
  ];
  const SORT_OPTIONS = activeTab === 'branches' ? SORT_OPTIONS_BRANCH : SORT_OPTIONS_DEPT;

  if (loading) {
    return (
      <div>
        <PageHeader title={activeTab === 'departments' ? t('departments') : t('branches')}>
          <Skeleton className="h-10 w-24" variant="rect" />
        </PageHeader>
        <PageLoader mode="table" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={activeTab === 'departments' ? t('departments') : t('branches')}>
        {activeTab === 'branches' ? (
          <button
            onClick={openBranchCreate}
            className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium"
          >
            {t('add')} {t('branches')}
          </button>
        ) : (
          <button
            onClick={openDeptCreate}
            className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium"
          >
            {t('add')} {t('departments')}
          </button>
        )}
      </PageHeader>

      <ListToolbar search={search} onSearchChange={setSearch} sortBy={sortBy} onSortChange={setSortBy} sortOptions={SORT_OPTIONS} viewMode={viewMode} onViewModeChange={setViewMode} searchPlaceholder={t('search')}>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} className="rounded border-slate-400" />
          <span className="text-sm text-slate-800">{t('inactive')}</span>
        </label>
      </ListToolbar>

      {activeTab === 'branches' && (
        <>
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
                    {branchSorted.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-slate-600">{t('noData')}</td>
                      </tr>
                    ) : (
                      branchSorted.map((b) => (
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
                            <ActionButtons onView={() => openBranchView(b)} onEdit={() => openBranchEdit(b)} onToggleActive={() => handleBranchToggleActive(b)} isActive={b.isActive} viewLabel={t('view')} editLabel={t('edit')} toggleLabel={b.isActive ? t('makeInactive') : t('makeActive')} />
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
              {branchSorted.length === 0 ? (
                <div className="col-span-full rounded-xl bg-white p-12 text-center text-slate-600 border border-slate-200">{t('noData')}</div>
              ) : (
                branchSorted.map((b) => (
                  <div key={b._id} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                    <h3 className="font-semibold text-slate-900">{b.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">{b.address}</p>
                    <p className="text-sm text-slate-600">{b.phoneNumber}</p>
                    <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${b.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>{b.isActive ? t('active') : t('inactive')}</span>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                      <ActionButtons onView={() => openBranchView(b)} onEdit={() => openBranchEdit(b)} onToggleActive={() => handleBranchToggleActive(b)} isActive={b.isActive} viewLabel={t('view')} editLabel={t('edit')} toggleLabel={b.isActive ? t('makeInactive') : t('makeActive')} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {activeTab === 'departments' && (
        <>
          {viewMode === 'table' ? (
            <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('departmentName')}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('description')}</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('status')}</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {deptSorted.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-slate-600">{t('noData')}</td>
                      </tr>
                    ) : (
                      deptSorted.map((d) => (
                        <tr key={d._id} className="hover:bg-uff-surface">
                          <td className="px-4 py-3 text-slate-800">{d.name}</td>
                          <td className="px-4 py-3 text-slate-700">{d.description || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${d.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                              {d.isActive ? t('active') : t('inactive')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <ActionButtons onView={() => openDeptView(d)} onEdit={() => openDeptEdit(d)} onToggleActive={() => handleDeptToggleActive(d)} isActive={d.isActive} viewLabel={t('view')} editLabel={t('edit')} toggleLabel={d.isActive ? t('makeInactive') : t('makeActive')} />
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
              {deptSorted.length === 0 ? (
                <div className="col-span-full rounded-xl bg-white p-12 text-center text-slate-600 border border-slate-200">{t('noData')}</div>
              ) : (
                deptSorted.map((d) => (
                  <div key={d._id} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                    <h3 className="font-semibold text-slate-900">{d.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">{d.description || '—'}</p>
                    <span className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${d.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>{d.isActive ? t('active') : t('inactive')}</span>
                    <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                      <ActionButtons onView={() => openDeptView(d)} onEdit={() => openDeptEdit(d)} onToggleActive={() => handleDeptToggleActive(d)} isActive={d.isActive} viewLabel={t('view')} editLabel={t('edit')} toggleLabel={d.isActive ? t('makeInactive') : t('makeActive')} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}

      {/* Branch Modal */}
      <Modal
        open={!!branchModal}
        onClose={() => setBranchModal(null)}
        title={`${branchModal === 'view' ? t('view') : branchModal === 'create' ? t('create') : t('edit')} ${t('branches')}`}
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            {branchModal !== 'view' && (
              <button onClick={handleBranchSave} disabled={saving || !branchForm.name || !branchForm.address || !branchForm.phoneNumber} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition">
                {saving ? '...' : t('save')}
              </button>
            )}
            {branchModal === 'view' && branchEditingId && (
              <button onClick={() => setBranchModal('edit')} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium transition">
                {t('edit')}
              </button>
            )}
            <button onClick={() => setBranchModal(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
              {branchModal === 'view' ? t('close') : t('cancel')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('branchName')} <span className="text-red-500" aria-hidden="true">*</span></label>
            <ValidatedInput type="text" value={branchForm.name} onChange={(v) => setBranchForm((f) => ({ ...f, name: v }))} fieldType="name" placeholderHint="e.g. UFF Main Factory" readOnly={branchModal === 'view'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('address')} <span className="text-red-500" aria-hidden="true">*</span></label>
            <ValidatedInput type="text" value={branchForm.address} onChange={(v) => setBranchForm((f) => ({ ...f, address: v }))} fieldType="address" readOnly={branchModal === 'view'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('phoneNumber')} <span className="text-red-500" aria-hidden="true">*</span></label>
            <ValidatedInput type="tel" value={branchForm.phoneNumber} onChange={(v) => setBranchForm((f) => ({ ...f, phoneNumber: v }))} fieldType="phone" readOnly={branchModal === 'view'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('email')}</label>
            <ValidatedInput type="email" value={branchForm.email} onChange={(v) => setBranchForm((f) => ({ ...f, email: v }))} fieldType="email" readOnly={branchModal === 'view'} />
          </div>
        </div>
      </Modal>

      {/* Department Modal */}
      <Modal
        open={!!deptModal}
        onClose={() => setDeptModal(null)}
        title={`${deptModal === 'view' ? t('view') : deptModal === 'create' ? t('create') : t('edit')} ${t('departments')}`}
        size="lg"
        footer={
          <div className="flex gap-3 justify-end">
            {deptModal !== 'view' && (
              <button onClick={handleDeptSave} disabled={saving || !deptForm.name.trim()} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition">
                {saving ? '...' : t('save')}
              </button>
            )}
            {deptModal === 'view' && deptEditingId && (
              <button onClick={() => setDeptModal('edit')} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium transition">
                {t('edit')}
              </button>
            )}
            <button onClick={() => setDeptModal(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
              {deptModal === 'view' ? t('close') : t('cancel')}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('departmentName')} <span className="text-red-500" aria-hidden="true">*</span></label>
            <ValidatedInput type="text" value={deptForm.name} onChange={(v) => setDeptForm((f) => ({ ...f, name: v }))} fieldType="name" placeholderHint="e.g. Production, Quality Control" readOnly={deptModal === 'view'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('description')}</label>
            <ValidatedInput type="text" value={deptForm.description} onChange={(v) => setDeptForm((f) => ({ ...f, description: v }))} fieldType="address" readOnly={deptModal === 'view'} placeholderHint={t('optional')} />
          </div>
        </div>
      </Modal>

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
