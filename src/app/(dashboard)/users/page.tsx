'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';

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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [filterByEmployeeType, setFilterByEmployeeType] = useState<string>('all');
  const [filterByRole, setFilterByRole] = useState<string>('all');

  const [adminForm, setAdminForm] = useState({ email: '', password: '' });
  const [editAdminForm, setEditAdminForm] = useState({ email: '', password: '', isActive: true });

  const canAccess = user?.role === 'admin';

  const isAdminUser = (u: UserRecord) => u.role === 'admin' && !u.employeeId;
  const getDisplayName = (u: UserRecord) => (u.employeeId ? u.employeeId.name : u.email);

  const filteredUsers = (Array.isArray(users) ? users : []).filter((u) => {
    const q = search.toLowerCase();
    if (q) {
      const name = getDisplayName(u).toLowerCase();
      const email = (u.employeeId?.email ?? u.email).toLowerCase();
      if (!name.includes(q) && !email.includes(q)) return false;
    }
    if (filterByRole !== 'all' && u.role !== filterByRole) return false;
    if (filterByEmployeeType !== 'all') {
      if (filterByEmployeeType === 'admin') {
        if (u.employeeId) return false;
      } else if (!u.employeeId || u.employeeId.employeeType !== filterByEmployeeType) {
        return false;
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
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setMessage({ type: 'error', text: t('error') }));
  };

  useEffect(() => {
    if (!canAccess) return;
    setLoading(true);
    fetchUsers();
    setLoading(false);
  }, [canAccess]);

  const handleCreateAdmin = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminForm.email, password: adminForm.password || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      setMessage({ type: 'success', text: t('saveSuccess') });
      setModal(null);
      setAdminForm({ email: '', password: '' });
      if (data.generatedPassword) setPasswordModal(data.generatedPassword);
      fetchUsers();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('error') });
    } finally {
      setSaving(false);
    }
  };

  const openViewUser = (u: UserRecord) => {
    setEditAdminForm({ email: u.employeeId?.email ?? u.email, password: '', isActive: u.isActive });
    setEditingUserId(u._id);
    setModal('view');
  };

  const openEditAdmin = (u: UserRecord) => {
    if (!isAdminUser(u)) return;
    setEditAdminForm({ email: u.email, password: '', isActive: u.isActive });
    setEditingUserId(u._id);
    setModal('edit');
  };

  const handleUpdateAdmin = async () => {
    if (!editingUserId) return;
    setSaving(true);
    setMessage(null);
    try {
      const body: { email?: string; password?: string; isActive?: boolean } = {
        email: editAdminForm.email,
        isActive: editAdminForm.isActive,
      };
      if (editAdminForm.password.trim()) body.password = editAdminForm.password;
      const res = await fetch(`/api/users/${editingUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      setMessage({ type: 'success', text: t('saveSuccess') });
      setModal(null);
      setEditingUserId(null);
      fetchUsers();
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('error') });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAdminActive = async (u: UserRecord) => {
    if (!isAdminUser(u)) return;
    try {
      await fetch(`/api/users/${u._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !u.isActive }),
      });
      fetchUsers();
    } catch {
      setMessage({ type: 'error', text: t('error') });
    }
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
      <div className="flex justify-center py-12">
        <div className="animate-spin w-10 h-10 border-4 border-uff-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('users')}>
        <button
          onClick={() => {
            setAdminForm({ email: '', password: '' });
            setModal('create');
          }}
          className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium"
        >
          {t('add')} {t('admin')}
        </button>
      </PageHeader>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
        >
          {message.text}
        </div>
      )}

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
                      <td className="px-4 py-3 text-slate-800">{u.employeeId?.email ?? u.email}</td>
                      <td className="px-4 py-3 text-slate-800">{t(u.role) || u.role}</td>
                      <td className="px-4 py-3 text-slate-800">
                        {u.employeeId
                          ? u.employeeId.employeeType === 'full_time'
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
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => openViewUser(u)}
                          className="text-slate-600 hover:text-slate-800 font-medium mr-2"
                        >
                          {t('view')}
                        </button>
                        {isAdminUser(u) ? (
                          <>
                            <button
                              onClick={() => openEditAdmin(u)}
                              className="text-uff-accent hover:text-uff-accent-hover font-medium mr-2"
                            >
                              {t('edit')}
                            </button>
                            <button
                              onClick={() => handleToggleAdminActive(u)}
                              className={`font-medium ${u.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'}`}
                            >
                              {u.isActive ? t('makeInactive') : t('makeActive')}
                            </button>
                          </>
                        ) : null}
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
                <p className="text-sm text-slate-600">{u.employeeId?.email ?? u.email}</p>
                <p className="text-sm text-slate-600">
                  {t('role')}: {t(u.role) || u.role}
                </p>
                <p className="text-sm text-slate-600">
                  {t('employeeType')}:{' '}
                  {u.employeeId
                    ? u.employeeId.employeeType === 'full_time'
                      ? t('fullTime')
                      : t('contractor')
                    : '—'}
                </p>
                <span
                  className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium ${u.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-800'}`}
                >
                  {u.isActive ? t('active') : t('inactive')}
                </span>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end gap-2">
                  <button
                    onClick={() => openViewUser(u)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium text-sm hover:bg-slate-100"
                  >
                    {t('view')}
                  </button>
                  {isAdminUser(u) && (
                    <>
                      <button
                        onClick={() => openEditAdmin(u)}
                        className="px-3 py-1.5 rounded-lg border border-amber-500/60 bg-amber-50 text-amber-800 font-medium text-sm hover:bg-amber-100"
                      >
                        {t('edit')}
                      </button>
                      <button
                        onClick={() => handleToggleAdminActive(u)}
                        className={`px-3 py-1.5 rounded-lg border font-medium text-sm ${u.isActive ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'}`}
                      >
                        {u.isActive ? t('makeInactive') : t('makeActive')}
                      </button>
                    </>
                  )}
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
              {t('add')} {t('admin')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('email')}</label>
                <input
                  type="email"
                  value={adminForm.email}
                  onChange={(e) => setAdminForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                  placeholder="admin@example.com"
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
                    return u?.employeeId
                      ? u.employeeId.employeeType === 'full_time'
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
              {isAdminUser(users.find((x) => x._id === editingUserId) ?? { _id: '', email: '', role: '', employeeId: null, isActive: true, createdAt: '' }) && (
                <button
                  onClick={() => {
                    const u = users.find((x) => x._id === editingUserId);
                    if (u) openEditAdmin(u);
                  }}
                  className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium"
                >
                  {t('edit')}
                </button>
              )}
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
              {t('edit')} {t('admin')}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-800 mb-1">{t('email')}</label>
                <input
                  type="email"
                  value={editAdminForm.email}
                  onChange={(e) => setEditAdminForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                />
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
                onClick={handleUpdateAdmin}
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
    </div>
  );
}
