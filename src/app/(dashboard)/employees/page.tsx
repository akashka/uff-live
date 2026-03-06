'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import UserAvatar from '@/components/UserAvatar';
import ListToolbar from '@/components/ListToolbar';
import ActionButtons from '@/components/ActionButtons';
import { PageLoader, Skeleton } from '@/components/Skeleton';

interface Branch {
  _id: string;
  name: string;
}

interface Employee {
  _id: string;
  name: string;
  contactNumber: string;
  email: string;
  emergencyNumber: string;
  dateOfBirth: string;
  gender: string;
  photo?: string;
  aadhaarNumber?: string;
  pfNumber?: string;
  panNumber?: string;
  bankName?: string;
  bankBranch?: string;
  ifscCode?: string;
  accountNumber?: string;
  upiId?: string;
  employeeType: string;
  branches: Branch[];
  monthlySalary?: number;
  salaryBreakup?: { pf?: number; esi?: number; other?: number };
  pfOpted?: boolean;
  monthlyPfAmount?: number;
  esiOpted?: boolean;
  monthlyEsiAmount?: number;
  isActive: boolean;
}

export default function EmployeesPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [passwordModal, setPasswordModal] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: '',
    contactNumber: '',
    email: '',
    photo: '',
    emergencyNumber: '',
    dateOfBirth: '',
    gender: 'male' as 'male' | 'female' | 'other',
    aadhaarNumber: '',
    pfNumber: '',
    panNumber: '',
    bankName: '',
    bankBranch: '',
    ifscCode: '',
    accountNumber: '',
    upiId: '',
    employeeType: 'full_time' as 'full_time' | 'contractor',
    branches: [] as string[],
    monthlySalary: 0,
    salaryBreakup: { pf: 0, esi: 0, other: 0 },
    pfOpted: false,
    monthlyPfAmount: 0,
    esiOpted: false,
    monthlyEsiAmount: 0,
    role: 'employee' as string,
  });

  const fetchEmployees = () => {
    fetch(`/api/employees?includeInactive=${includeInactive}`)
      .then((r) => r.json())
      .then((data) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => setMessage({ type: 'error', text: t('error') }));
  };

  useEffect(() => {
    setLoading(true);
    fetchEmployees();
    fetch('/api/branches?includeInactive=true')
      .then((r) => r.json())
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => {});
    setLoading(false);
  }, [includeInactive]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || editingId === editId) return;
    const e = employees.find((emp) => emp._id === editId);
    if (e) {
      openEdit(e);
    } else if (employees.length > 0) {
      fetch(`/api/employees/${editId}`)
        .then((r) => r.json())
        .then((emp) => {
          if (emp._id) openEdit(emp as Employee);
        })
        .catch(() => {});
    }
  }, [searchParams.get('edit'), employees, editingId]);

  const openCreate = () => {
    setPhotoFile(null);
    setForm({
      name: '',
      contactNumber: '',
      email: '',
      photo: '',
      emergencyNumber: '',
      dateOfBirth: '',
      gender: 'male',
      aadhaarNumber: '',
      pfNumber: '',
      panNumber: '',
      bankName: '',
      bankBranch: '',
      ifscCode: '',
      accountNumber: '',
      upiId: '',
      employeeType: 'full_time',
      branches: [],
      monthlySalary: 0,
      salaryBreakup: { pf: 0, esi: 0, other: 0 },
      pfOpted: false,
      monthlyPfAmount: 0,
      esiOpted: false,
      monthlyEsiAmount: 0,
      role: 'employee',
    });
    setModal('create');
    setEditingId(null);
  };

  const openView = (e: Employee) => {
    openEdit(e);
    setModal('view');
  };

  const openEdit = (e: Employee) => {
    setPhotoFile(null);
    setForm({
      name: e.name,
      contactNumber: e.contactNumber,
      email: e.email,
      photo: e.photo || '',
      emergencyNumber: e.emergencyNumber,
      dateOfBirth: e.dateOfBirth ? e.dateOfBirth.slice(0, 10) : '',
      gender: e.gender as 'male' | 'female' | 'other',
      aadhaarNumber: e.aadhaarNumber || '',
      pfNumber: e.pfNumber || '',
      panNumber: e.panNumber || '',
      bankName: e.bankName || '',
      bankBranch: e.bankBranch || '',
      ifscCode: e.ifscCode || '',
      accountNumber: e.accountNumber || '',
      upiId: e.upiId || '',
      employeeType: e.employeeType as 'full_time' | 'contractor',
      branches: (e.branches ?? []).map((b): string => (typeof b === 'object' && b && '_id' in b ? (b as Branch)._id : String(b))),
      monthlySalary: e.monthlySalary || 0,
      salaryBreakup: {
        pf: e.salaryBreakup?.pf ?? 0,
        esi: e.salaryBreakup?.esi ?? 0,
        other: e.salaryBreakup?.other ?? 0,
      },
      pfOpted: e.pfOpted ?? false,
      monthlyPfAmount: e.monthlyPfAmount || 0,
      esiOpted: e.esiOpted ?? false,
      monthlyEsiAmount: e.monthlyEsiAmount || 0,
      role: 'employee',
    });
    setModal('edit');
    setEditingId(e._id);
  };

  const uploadPhoto = async (empId: string, file: File): Promise<void> => {
    const fd = new FormData();
    fd.append('photo', file);
    const res = await fetch(`/api/employees/${empId}/photo`, { method: 'POST', body: fd });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || t('error'));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (modal === 'create') {
        const payload = {
          ...form,
          dateOfBirth: form.dateOfBirth || new Date().toISOString(),
        };
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        const empId = data.employee?._id;
        if (empId && photoFile) {
          await uploadPhoto(empId, photoFile);
        }
        setMessage({ type: 'success', text: t('saveSuccess') });
        setModal(null);
        if (data.generatedPassword) setPasswordModal(data.generatedPassword);
        fetchEmployees();
      } else if (editingId) {
        if (photoFile) {
          await uploadPhoto(editingId, photoFile);
        }
        const payload: Record<string, unknown> = {
          ...form,
          dateOfBirth: form.dateOfBirth || undefined,
        };
        // Don't overwrite photo: it's managed by the upload API. Including form.photo would overwrite the freshly uploaded image.
        delete payload.photo;
        const res = await fetch(`/api/employees/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        setMessage({ type: 'success', text: t('saveSuccess') });
        setModal(null);
        fetchEmployees();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : t('error') });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (e: Employee) => {
    try {
      await fetch(`/api/employees/${e._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !e.isActive }),
      });
      fetchEmployees();
    } catch {
      setMessage({ type: 'error', text: t('error') });
    }
  };

  const toggleBranch = (id: string) => {
    setForm((f) => ({
      ...f,
      branches: f.branches.includes(id) ? f.branches.filter((b) => b !== id) : [...f.branches, id],
    }));
  };

  const copyPassword = (pwd: string) => {
    navigator.clipboard.writeText(pwd);
  };

  const filteredEmployees = (Array.isArray(employees) ? employees : []).filter((e) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      e.email.toLowerCase().includes(q) ||
      e.contactNumber.includes(q)
    );
  });

  const sortedEmployees = [...filteredEmployees].sort((a, b) => {
    switch (sortBy) {
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'type-asc':
        return a.employeeType.localeCompare(b.employeeType);
      case 'type-desc':
        return b.employeeType.localeCompare(a.employeeType);
      default:
        return a.name.localeCompare(b.name);
    }
  });

  const SORT_OPTIONS = [
    { value: 'name-asc', label: `${t('employeeName')} (A-Z)` },
    { value: 'name-desc', label: `${t('employeeName')} (Z-A)` },
    { value: 'type-asc', label: `${t('employeeType')} (A-Z)` },
    { value: 'type-desc', label: `${t('employeeType')} (Z-A)` },
  ];

  const closeForm = () => setModal(null);

  if (loading) {
    return (
      <div>
        <PageHeader title={t('employees')}>
          <Skeleton className="h-10 w-28" variant="rect" />
        </PageHeader>
        <PageLoader mode="table" />
      </div>
    );
  }

  /* Full-screen add/edit form */
  if (modal) {
    const FormSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
      <section className="mb-8 last:mb-0">
        <h3 className="text-base font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">{title}</h3>
        {children}
      </section>
    );

    return (
      <div className="flex flex-col h-full min-h-[calc(100vh-12rem)]">
        <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={closeForm}
              className="shrink-0 p-2 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center gap-2"
              aria-label={t('backToEmployees')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="hidden sm:inline text-slate-700">{t('backToEmployees')}</span>
            </button>
            <h1 className="text-xl font-semibold text-slate-900 truncate">
              {modal === 'create' ? t('add') : modal === 'view' ? t('view') : t('edit')} {t('employees')}
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {modal !== 'view' && (
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.contactNumber || !form.email || !form.emergencyNumber || !form.dateOfBirth || (form.employeeType === 'contractor' && form.pfOpted && (!form.monthlyPfAmount || !form.pfNumber)) || (form.employeeType === 'contractor' && form.esiOpted && !form.monthlyEsiAmount)}
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
            <button onClick={closeForm} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700">
              {modal === 'view' ? t('close') : t('cancel')}
            </button>
          </div>
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {message.text}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl space-y-8">
            <FormSection title={t('photo')}>
              <div className="flex items-center gap-6">
                <div className="shrink-0">
                  {photoFile ? (
                    <img src={URL.createObjectURL(photoFile)} alt="Preview" className="w-24 h-24 rounded-full object-cover border-2 border-slate-200" />
                  ) : (
                    <UserAvatar photo={form.photo || undefined} name={form.name} size="lg" className="w-24 h-24" />
                  )}
                </div>
                {modal !== 'view' && (
                  <div>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-800 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-uff-accent file:text-uff-primary file:font-medium hover:file:bg-uff-accent-hover"
                    />
                    <p className="text-xs text-slate-600 mt-1">JPEG, PNG, WebP or GIF. Max 2MB.</p>
                  </div>
                )}
              </div>
            </FormSection>

            <FormSection title={t('employeeName') + ' & ' + t('contactNumber')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('employeeName')}</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    readOnly={modal === 'view'}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('contactNumber')}</label>
                  <input
                    type="tel"
                    value={form.contactNumber}
                    onChange={(e) => setForm((f) => ({ ...f, contactNumber: e.target.value }))}
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
                    readOnly={modal === 'edit' || modal === 'view'}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'edit' || modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('emergencyNumber')}</label>
                  <input
                    type="tel"
                    value={form.emergencyNumber}
                    onChange={(e) => setForm((f) => ({ ...f, emergencyNumber: e.target.value }))}
                    readOnly={modal === 'view'}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('dateOfBirth')}</label>
                  <input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                    readOnly={modal === 'view'}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('gender')}</label>
                  <select
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as 'male' | 'female' | 'other' }))}
                    disabled={modal === 'view'}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                  >
                    <option value="male">{t('male')}</option>
                    <option value="female">{t('female')}</option>
                    <option value="other">{t('other')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('employeeType')}</label>
                  <select
                    value={form.employeeType}
                    onChange={(e) => setForm((f) => ({ ...f, employeeType: e.target.value as 'full_time' | 'contractor' }))}
                    disabled={modal === 'view'}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                  >
                    <option value="full_time">{t('fullTime')}</option>
                    <option value="contractor">{t('contractor')}</option>
                  </select>
                </div>
                {modal === 'create' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">{t('role')}</label>
                    <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent">
                      <option value="employee">{t('employee')}</option>
                      {user?.role === 'admin' && (
                        <>
                          <option value="hr">{t('hr')}</option>
                          <option value="finance">{t('finance')}</option>
                          <option value="admin">{t('admin')}</option>
                        </>
                      )}
                    </select>
                  </div>
                )}
              </div>
            </FormSection>

            {form.employeeType === 'contractor' && (
              <FormSection title={t('pfDeduction') + ' & ' + t('esiDeduction')}>
                <div className="space-y-4">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={form.pfOpted} onChange={(e) => setForm((f) => ({ ...f, pfOpted: e.target.checked }))} disabled={modal === 'view'} className="rounded" />
                    <span className="text-sm font-medium text-slate-800">{t('pfOpted')}</span>
                  </label>
                  {form.pfOpted && (
                    <div className="max-w-xs">
                      <label className="block text-sm font-medium text-slate-800 mb-1">{t('monthlyPfAmount')} (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.monthlyPfAmount ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, monthlyPfAmount: parseFloat(e.target.value) || 0 }))}
                        readOnly={modal === 'view'}
                        className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                        required={form.pfOpted}
                      />
                    </div>
                  )}
                  <label className="flex items-center gap-2 mt-4">
                    <input type="checkbox" checked={form.esiOpted} onChange={(e) => setForm((f) => ({ ...f, esiOpted: e.target.checked }))} disabled={modal === 'view'} className="rounded" />
                    <span className="text-sm font-medium text-slate-800">{t('esiOpted')}</span>
                  </label>
                  {form.esiOpted && (
                    <div className="max-w-xs mt-2">
                      <label className="block text-sm font-medium text-slate-800 mb-1">{t('monthlyEsiAmount')} (₹)</label>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={form.monthlyEsiAmount ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, monthlyEsiAmount: parseFloat(e.target.value) || 0 }))}
                        readOnly={modal === 'view'}
                        className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                        required={form.esiOpted}
                      />
                    </div>
                  )}
                </div>
              </FormSection>
            )}

            {form.employeeType === 'full_time' && (
              <FormSection title={t('salaryBreakup')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">{t('monthlySalary')} (₹)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.monthlySalary || ''}
                      onChange={(e) => setForm((f) => ({ ...f, monthlySalary: parseFloat(e.target.value) || 0 }))}
                      readOnly={modal === 'view'}
                      className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                      placeholder="Gross salary"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">{t('pf')} (₹)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.salaryBreakup?.pf ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, salaryBreakup: { ...f.salaryBreakup, pf: parseFloat(e.target.value) || 0 } }))}
                      readOnly={modal === 'view'}
                      className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">{t('esi')} (₹)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.salaryBreakup?.esi ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, salaryBreakup: { ...f.salaryBreakup, esi: parseFloat(e.target.value) || 0 } }))}
                      readOnly={modal === 'view'}
                      className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-800 mb-1">{t('otherDeductions')} (₹)</label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={form.salaryBreakup?.other ?? ''}
                      onChange={(e) => setForm((f) => ({ ...f, salaryBreakup: { ...f.salaryBreakup, other: parseFloat(e.target.value) || 0 } }))}
                      readOnly={modal === 'view'}
                      className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                    />
                  </div>
                </div>
                {(form.monthlySalary || 0) > 0 && (
                  <p className="text-sm text-slate-600 mt-2">
                    {t('netSalary')}: ₹{((form.monthlySalary || 0) - (form.salaryBreakup?.pf || 0) - (form.salaryBreakup?.esi || 0) - (form.salaryBreakup?.other || 0)).toLocaleString()}
                  </p>
                )}
              </FormSection>
            )}

            <FormSection title={t('aadhaarNumber') + ' / ' + t('pfNumber') + ' / ' + t('panNumber')}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('aadhaarNumber')}</label>
                  <input type="text" value={form.aadhaarNumber} onChange={(e) => setForm((f) => ({ ...f, aadhaarNumber: e.target.value }))} readOnly={modal === 'view'} className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('pfNumber')}</label>
                  <input type="text" value={form.pfNumber} onChange={(e) => setForm((f) => ({ ...f, pfNumber: e.target.value }))} readOnly={modal === 'view'} className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('panNumber')}</label>
                  <input type="text" value={form.panNumber} onChange={(e) => setForm((f) => ({ ...f, panNumber: e.target.value }))} readOnly={modal === 'view'} className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`} />
                </div>
              </div>
            </FormSection>

            <FormSection title={t('bankingDetails')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('bankName')}</label>
                  <input type="text" value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} readOnly={modal === 'view'} className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`} placeholder="e.g. State Bank of India" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('bankBranch')}</label>
                  <input type="text" value={form.bankBranch} onChange={(e) => setForm((f) => ({ ...f, bankBranch: e.target.value }))} readOnly={modal === 'view'} className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`} placeholder="Branch name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('ifscCode')}</label>
                  <input type="text" value={form.ifscCode} onChange={(e) => setForm((f) => ({ ...f, ifscCode: e.target.value.toUpperCase() }))} readOnly={modal === 'view'} className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`} placeholder="e.g. SBIN0001234" maxLength={11} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('accountNumber')}</label>
                  <input type="text" value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))} readOnly={modal === 'view'} className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`} placeholder="Account number" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('upiId')}</label>
                  <input type="text" value={form.upiId} onChange={(e) => setForm((f) => ({ ...f, upiId: e.target.value }))} readOnly={modal === 'view'} className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`} placeholder="e.g. name@bank" />
                </div>
              </div>
            </FormSection>

            <FormSection title={t('selectBranches')}>
              {branches.length === 0 && (
                <p className="text-uff-accent text-sm mb-2">{t('addBranchFirst')}</p>
              )}
              <div className="flex flex-wrap gap-3">
                {(Array.isArray(branches) ? branches : []).map((b) => (
                  <label key={b._id} className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 ${modal !== 'view' ? 'hover:bg-slate-50 cursor-pointer' : 'bg-slate-50 cursor-default'}`}>
                    <input type="checkbox" checked={form.branches.includes(b._id)} onChange={() => toggleBranch(b._id)} disabled={modal === 'view'} className="rounded" />
                    <span className="text-sm text-slate-800">{b.name}</span>
                  </label>
                ))}
              </div>
            </FormSection>
          </div>
        </div>

        {passwordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-lg font-semibold text-uff-accent mb-2">{t('generatedPassword')}</h2>
              <p className="text-slate-600 text-sm mb-4">Save this password securely. It will not be shown again.</p>
              <div className="flex items-center gap-2 p-4 bg-slate-100 rounded-lg font-mono text-lg break-all">
                {passwordModal}
                <button onClick={() => copyPassword(passwordModal)} className="ml-auto px-3 py-1 rounded bg-uff-accent text-uff-primary text-sm">{t('copyPassword')}</button>
              </div>
              <button onClick={() => setPasswordModal(null)} className="mt-4 w-full py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white">{t('close')}</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('employees')}>
        <button
          onClick={openCreate}
          disabled={branches.length === 0}
          className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          title={!Array.isArray(branches) || branches.length === 0 ? t('addBranchFirst') : ''}
        >
          {t('add')} {t('employees')}
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
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded border-slate-400"
          />
          <span className="text-sm text-slate-800">{t('inactive')}</span>
        </label>
      </ListToolbar>

      {viewMode === 'table' ? (
        <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('employeeName')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('contactNumber')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('employeeType')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('status')}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-600">
                      {t('noData')}
                    </td>
                  </tr>
                ) : (
                  sortedEmployees.map((e) => (
                    <tr key={e._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar photo={e.photo} name={e.name} size="sm" className="w-8 h-8 shrink-0" />
                          <span className="text-slate-800">{e.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{e.contactNumber}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {e.employeeType === 'full_time' ? t('fullTime') : t('contractor')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${e.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                          {e.isActive ? t('active') : t('inactive')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <ActionButtons
                          onView={() => openView(e)}
                          onEdit={() => openEdit(e)}
                          onToggleActive={() => handleToggleActive(e)}
                          passbookHref={`/employees/${e._id}/passbook`}
                          isActive={e.isActive}
                          viewLabel={t('view')}
                          editLabel={t('edit')}
                          toggleLabel={e.isActive ? t('makeInactive') : t('makeActive')}
                          passbookLabel={t('viewPassbook')}
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
          {sortedEmployees.length === 0 ? (
            <div className="col-span-full rounded-xl bg-white p-12 text-center text-slate-600 border border-slate-200">
              {t('noData')}
            </div>
          ) : (
            sortedEmployees.map((e) => (
              <div
                key={e._id}
                className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition"
              >
                <div className="flex items-start gap-3">
                  <UserAvatar photo={e.photo} name={e.name} size="lg" className="w-12 h-12 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 truncate">{e.name}</h3>
                    <p className="text-sm text-slate-600 truncate">{e.email}</p>
                    <p className="text-sm text-slate-600">{e.contactNumber}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${e.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                        {e.isActive ? t('active') : t('inactive')}
                      </span>
                      <span className="text-xs text-slate-500">
                        {e.employeeType === 'full_time' ? t('fullTime') : t('contractor')}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <ActionButtons
                    onView={() => openView(e)}
                    onEdit={() => openEdit(e)}
                    onToggleActive={() => handleToggleActive(e)}
                    passbookHref={`/employees/${e._id}/passbook`}
                    isActive={e.isActive}
                    viewLabel={t('view')}
                    editLabel={t('edit')}
                    toggleLabel={e.isActive ? t('makeInactive') : t('makeActive')}
                    passbookLabel={t('viewPassbook')}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {passwordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-uff-accent mb-2">{t('generatedPassword')}</h2>
            <p className="text-slate-600 text-sm mb-4">
              Save this password securely. It will not be shown again.
            </p>
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
