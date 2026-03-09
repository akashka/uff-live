'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ValidatedInput from '@/components/ValidatedInput';
import ListToolbar from '@/components/ListToolbar';
import ActionButtons from '@/components/ActionButtons';
import { PageLoader, Skeleton } from '@/components/Skeleton';
import ConfirmModal from '@/components/ConfirmModal';
import { toast } from '@/lib/toast';

interface UserRecord {
  _id: string;
  email: string;
  role: string;
  isActive: boolean;
  employeeId: null | { _id: string; name: string; email: string; employeeType: string };
  createdAt: string;
}

export default function UsersPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [passwordModal, setPasswordModal] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [filterByEmployeeType, setFilterByEmployeeType] = useState<string>('all');
  const [filterByRole, setFilterByRole] = useState<string>('all');
  const [confirmModal, setConfirmModal] = useState<{ message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => Promise<void> } | null>(null);

  const [adminForm, setAdminForm] = useState({ email: '', password: '', role: 'admin' as string });
  const [editAdminForm, setEditAdminForm] = useState({ email: '', password: '', isActive: true, role: 'employee' as string });

  const canAccess = user?.role === 'admin';

  const isAdminUser = (u: UserRecord) => u.role === 'admin' && !u.employeeId;
  const getDisplayName = (u: UserRecord) => {
    const emp = u.employeeId;
    if (emp && typeof emp === 'object' && emp !== null && 'name' in emp && typeof (emp as { name?: string }).name === 'string') {
      return (emp as { name: string }).name;
    }
    return u.email || '';
  };
  const getEmail = (u: UserRecord) =>
    (u.employeeId && typeof u.employeeId === 'object' && 'email' in u.employeeId
      ? (u.employeeId as { email?: string }).email
      : null) ?? u.email ?? '';
  const getEmployeeType = (u: UserRecord): string | null => {
    const emp = u.employeeId;
    if (!emp || typeof emp !== 'object' || emp === null || !('employeeType' in emp)) return null;
    return (emp as { employeeType: string }).employeeType || null;
  };

  const filteredUsers = (Array.isArray(users) ? users : []).filter((u) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const name = getDisplayName(u).toLowerCase();
      const email = getEmail(u).toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    if (filterByRole !== 'all' && u.role !== filterByRole) return false;
    if (filterByEmployeeType !== 'all') {
      if (filterByEmployeeType === 'admin') {
        if (u.employeeId) return false;
      } else {
        const empType = getEmployeeType(u);
        if (!empType || empType !== filterByEmployeeType) return false;
      }
    }
    return true;
  });

  const sortedUsers = [...filteredUsers].sort((a, b) => {
    const nameA = getDisplayName(a);
    const nameB = getDisplayName(b);
    if (sortBy === 'name-desc') return nameB.localeCompare(nameA);
    if (sortBy === 'role-asc') return a.role.localeCompare(b.role);
    if (sortBy === 'role-desc') return b.role.localeCompare(a.role);
    return nameA.localeCompare(nameB);
  });

  const SORT_OPTIONS = [
    { value: 'name-asc', label: `${t('employeeName')} (A-Z)` },
    { value: 'name-desc', label: `${t('employeeName')} (Z-A)` },
    { value: 'role-asc', label: `${t('role')} (A-Z)` },
    { value: 'role-desc', label: `${t('role')} (Z-A)` },
  ];

  const fetchUsers = () => {
    setLoading(true);
    fetch('/api/users')
      .then((r) => {
        if (!r.ok) throw new Error('Fetch failed');
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data?.data)
          ? data.data
          : (Array.isArray(data) ? data : []);
        setUsers(list);
      })
      .catch(() => toast.error(t('error')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchUsers();
  }, [canAccess]);

  const handleCreateAdmin = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminForm.email, password: adminForm.password || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('saveSuccess'));
      setModal(null);
      setAdminForm({ email: '', password: '', role: 'admin' });
      if (data.generatedPassword) setPasswordModal(data.generatedPassword);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const openViewUser = (u: UserRecord) => {
    setEditAdminForm({ email: getEmail(u), password: '', isActive: u.isActive, role: u.role });
    setEditingUserId(u._id);
    setModal('view');
  };

  const openEditUser = (u: UserRecord) => {
    setEditAdminForm({ email: getEmail(u), password: '', isActive: u.isActive, role: u.role });
    setEditingUserId(u._id);
    setModal('edit');
  };

  const handleUpdateUser = async () => {
    if (!editingUserId) return;
    setSaving(true);
    try {
      const body: { email?: string; password?: string; isActive?: boolean; role?: string } = {
        email: editAdminForm.email,
        isActive: editAdminForm.isActive,
        role: editAdminForm.role,
      };
      if (editAdminForm.password.trim()) body.password = editAdminForm.password;
      const res = await fetch(`/api/users/${editingUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('saveSuccess'));
      setModal(null);
      setEditingUserId(null);
      fetchUsers();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleToggleUserActive = (u: UserRecord) => {
    setConfirmModal({
      message: u.isActive ? t('confirmMakeInactive') : t('confirmMakeActive'),
      confirmLabel: u.isActive ? t('makeInactive') : t('makeActive'),
      variant: 'warning',
      onConfirm: async () => {
        const res = await fetch(`/api/users/${u._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !u.isActive }),
        });
        if (!res.ok) throw new Error();
        toast.success(t('saveSuccess'));
        fetchUsers();
      },
    });
  };

  const copyPassword = (pwd: string) => {
    navigator.clipboard.writeText(pwd);
  };

  if (!canAccess) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-800">
        {t('accessDenied')}
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={t('users')}>
          <Skeleton className="h-10 w-20" variant="rect" />
        </PageHeader>
        <PageLoader mode="table" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('users')}>
        <button
          onClick={() => {
            setAdminForm({ email: '', password: '', role: 'admin' });
            setModal('create');
          }}
          className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium"
        >
          {t('add')} {t('user')}
        </button>
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
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <span>{t('employeeType')}:</span>
            <select
              value={filterByEmployeeType}
              onChange={(e) => setFilterByEmployeeType(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white"
            >
              <option value="all">{t('all')}</option>
              <option value="admin">{t('admin')}</option>
              <option value="full_time">{t('fullTime')}</option>
              <option value="contractor">{t('contractor')}</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-800">
            <span>{t('role')}:</span>
            <select
              value={filterByRole}
              onChange={(e) => setFilterByRole(e.target.value)}
              className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white"
            >
              <option value="all">{t('all')}</option>
              <option value="admin">{t('admin')}</option>
              <option value="finance">{t('finance')}</option>
              <option value="accountancy">{t('accountancy')}</option>
              <option value="hr">{t('hr')}</option>
              <option value="employee">{t('employee')}</option>
            </select>
          </label>
        </div>
      </ListToolbar>

      {viewMode === 'table' ? (
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('employeeName')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('email')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('role')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('employeeType')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('status')}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-600">
                      {t('noData')}
                    </td>
                  </tr>
                ) : (
                  sortedUsers.map((u) => (
                    <tr key={u._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-800">{getDisplayName(u)}</td>
                      <td className="px-4 py-3 text-slate-800">{getEmail(u)}</td>
                      <td className="px-4 py-3 text-slate-800">{t(u.role) || u.role}</td>
                      <td className="px-4 py-3 text-slate-800">
                        {getEmployeeType(u)
                          ? getEmployeeType(u) === 'full_time'
                            ? t('fullTime')
                            : t('contractor')
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-800'}`}
                        >
                          {u.isActive ? t('active') : t('inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => openViewUser(u)}
                          onEdit={() => openEditUser(u)}
                          onToggleActive={() => handleToggleUserActive(u)}
                          isActive={u.isActive}
                          viewLabel={t('view')}
                          editLabel={t('edit')}
                          toggleLabel={u.isActive ? t('makeInactive') : t('makeActive')}
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
          {sortedUsers.length === 0 ? (
            <div className="col-span-full rounded-xl bg-white p-12 text-center text-slate-600 border border-slate-200">
              {t('noData')}
            </div>
          ) : (
            sortedUsers.map((u) => (
              <div key={u._id} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                <h3 className="font-semibold text-slate-900">{getDisplayName(u)}</h3>
                <p className="text-sm text-slate-600">{getEmail(u)}</p>
                <p className="text-sm text-slate-600">
                  {t('role')}: {t(u.role) || u.role}
                </p>
                <p className="text-sm text-slate-600">
                  {t('employeeType')}:{' '}
                  {getEmployeeType(u)
                    ? getEmployeeType(u) === 'full_time'
                      ? t('fullTime')
                      : t('contractor')
                    : '—'}
                </p>
                <span
                  className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-800'}`}
                >
                  {u.isActive ? t('active') : t('inactive')}
                </span>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <ActionButtons
                    onView={() => openViewUser(u)}
                    onEdit={() => openEditUser(u)}
                    onToggleActive={() => handleToggleUserActive(u)}
                    isActive={u.isActive}
                    viewLabel={t('view')}
                    editLabel={t('edit')}
                    toggleLabel={u.isActive ? t('makeInactive') : t('makeActive')}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {modal === 'create' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold mb-4">
              {t('add')} {t('user')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('role')} <span className="text-red-500" aria-hidden="true">*</span></label>
                <select
                  value={adminForm.role}
                  onChange={(e) => setAdminForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                >
                  <option value="admin">{t('admin')}</option>
                  <option value="accountancy">{t('accountancy')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('email')} <span className="text-red-500" aria-hidden="true">*</span></label>
                <ValidatedInput
                  type="email"
                  value={adminForm.email}
                  onChange={(v) => setAdminForm((f) => ({ ...f, email: v }))}
                  fieldType="email"
                  placeholderHint="admin@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">
                  {t('password')} ({t('optional')})
                </label>
                <input
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                  placeholder="Leave blank to auto-generate"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleCreateAdmin}
                disabled={saving || !adminForm.email}
                className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50"
              >
                {saving ? '...' : t('save')}
              </button>
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'view' && editingUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold mb-4">
              {t('view')} {t('users')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('employeeName')}</label>
                <p className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800">
                  {getDisplayName(users.find((x) => x._id === editingUserId) ?? { _id: '', employeeId: null, email: '', role: '', isActive: true, createdAt: '' })}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('email')}</label>
                <p className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800">
                  {editAdminForm.email}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('role')}</label>
                <p className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800">
                  {t(users.find((x) => x._id === editingUserId)?.role ?? '') || users.find((x) => x._id === editingUserId)?.role}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('employeeType')}</label>
                <p className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800">
                      {(() => {
                    const u = users.find((x) => x._id === editingUserId);
                    const empType = u ? getEmployeeType(u) : null;
                    return empType
                      ? empType === 'full_time'
                        ? t('fullTime')
                        : t('contractor')
                      : '—';
                  })()}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('status')}</label>
                <p className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-800">
                  {editAdminForm.isActive ? t('active') : t('inactive')}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={() => {
                  const u = users.find((x) => x._id === editingUserId);
                  if (u) openEditUser(u);
                }}
                className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium"
              >
                {t('edit')}
              </button>
              <button
                onClick={() => {
                  setModal(null);
                  setEditingUserId(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'edit' && editingUserId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold mb-4">
              {t('edit')} {t('users')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('email')} <span className="text-red-500" aria-hidden="true">*</span></label>
                <ValidatedInput
                  type="email"
                  value={editAdminForm.email}
                  onChange={(v) => setEditAdminForm((f) => ({ ...f, email: v }))}
                  fieldType="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('role')} <span className="text-red-500" aria-hidden="true">*</span></label>
                <select
                  value={editAdminForm.role}
                  onChange={(e) => setEditAdminForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                >
                  <option value="admin">{t('admin')}</option>
                  <option value="finance">{t('finance')}</option>
                  <option value="accountancy">{t('accountancy')}</option>
                  <option value="hr">{t('hr')}</option>
                  <option value="employee">{t('employee')}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">
                  {t('newPassword')} ({t('optional')})
                </label>
                <input
                  type="password"
                  value={editAdminForm.password}
                  onChange={(e) => setEditAdminForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                  placeholder="Leave blank to keep current"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editAdminForm.isActive}
                  onChange={(e) => setEditAdminForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm font-medium text-slate-800">{t('active')}</span>
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button
                onClick={handleUpdateUser}
                disabled={saving || !editAdminForm.email}
                className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50"
              >
                {saving ? '...' : t('save')}
              </button>
              <button
                onClick={() => {
                  setModal(null);
                  setEditingUserId(null);
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-uff-accent mb-2">{t('generatedPassword')}</h2>
            <p className="text-slate-800 text-sm mb-4">Save this password securely. It will not be shown again.</p>
            <div className="flex items-center gap-2 p-4 bg-slate-100 rounded-lg font-mono text-lg break-all">
              {passwordModal}
              <button
                onClick={() => copyPassword(passwordModal)}
                className="ml-auto px-3 py-1 rounded bg-uff-accent text-uff-primary text-sm"
              >
                {t('copyPassword')}
              </button>
            </div>
            <button
              onClick={() => setPasswordModal(null)}
              className="mt-4 w-full py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white"
            >
              {t('close')}
            </button>
          </div>
        </div>
      )}

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
