'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 last:mb-0">
      <h3 className="text-base font-semibold text-slate-800 mb-4 pb-2 border-b border-slate-200">{title}</h3>
      {children}
    </section>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium text-slate-800 mb-1.5">
        {label}{required && <span className="text-red-500" aria-hidden="true"> *</span>}
      </label>
      {children}
    </div>
  );
}
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import Breadcrumb from '@/components/Breadcrumb';
import UserAvatar from '@/components/UserAvatar';
import ListToolbar from '@/components/ListToolbar';
import ActionButtons from '@/components/ActionButtons';
import ValidatedInput from '@/components/ValidatedInput';
import MultiselectDropdown from '@/components/MultiselectDropdown';
import { PageLoader, Skeleton } from '@/components/Skeleton';
import { useEmployees, useBranches, useDepartments } from '@/lib/hooks/useApi';
import ConfirmModal from '@/components/ConfirmModal';
import SaveOverlay from '@/components/SaveOverlay';
import ImportModal from '@/components/ImportModal';
import { EmployeeDocuments } from '@/components/EmployeeDocuments';
import { toast } from '@/lib/toast';
import { formatAmount } from '@/lib/utils';

interface Branch {
  _id: string;
  name: string;
}

interface Department {
  _id: string;
  name: string;
}

interface OtherDeduction {
  reason: string;
  amount: number;
}

interface Employee {
  _id: string;
  employeeId?: string;
  name: string;
  contactNumber: string;
  email: string;
  emergencyNumber: string;
  dateOfBirth: string;
  gender: string;
  maritalStatus?: string;
  anniversaryDate?: string;
  photo?: string;
  aadhaarNumber?: string;
  pfNumber?: string;
  esiNumber?: string;
  panNumber?: string;
  bankName?: string;
  bankBranch?: string;
  ifscCode?: string;
  accountNumber?: string;
  upiId?: string;
  employeeType: string;
  branches: Branch[];
  department?: Department | { _id: string; name: string };
  monthlySalary?: number;
  dailySalary?: number;
  overtimeCostPerHour?: number;
  salaryBreakup?: { pf?: number; esi?: number };
  otherDeductions?: OtherDeduction[];
  pfOpted?: boolean;
  monthlyPfAmount?: number;
  esiOpted?: boolean;
  monthlyEsiAmount?: number;
  isActive: boolean;
  documents?: { type: string; name?: string; fileUrl: string; uploadedAt: string }[];
}

export default function EmployeesPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [includeInactive, setIncludeInactive] = useState(false);
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterEmployeeType, setFilterEmployeeType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const { employees, total, limit, hasMore, loading, mutate: mutateEmployees } = useEmployees(includeInactive, {
    page,
    limit: PAGE_SIZE,
    search: search.trim() || undefined,
    departmentId: filterDepartment || undefined,
    branchId: filterBranch || undefined,
    employeeType: (filterEmployeeType as 'full_time' | 'contractor') || undefined,
  });
  const { branches } = useBranches(true);
  const { departments } = useDepartments(true);
  const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [passwordModal, setPasswordModal] = useState<{ email: string; contactNumber: string; employeeId: string; password: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('name-asc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => Promise<void> } | null>(null);
  const [importModal, setImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const canAdd = ['admin', 'finance', 'hr'].includes(user?.role || ''); // accountancy is read-only

  const [form, setForm] = useState({
    employeeId: '' as string,
    name: '',
    contactNumber: '',
    email: '',
    photo: '',
    emergencyNumber: '',
    dateOfBirth: '',
    gender: 'male' as 'male' | 'female' | 'other',
    maritalStatus: '' as '' | 'single' | 'married' | 'other',
    aadhaarNumber: '',
    pfNumber: '',
    esiNumber: '',
    panNumber: '',
    bankName: '',
    bankBranch: '',
    ifscCode: '',
    accountNumber: '',
    upiId: '',
    employeeType: 'full_time' as 'full_time' | 'contractor',
    branches: [] as string[],
    department: '' as string,
    monthlySalary: 0,
    dailySalary: 0,
    overtimeCostPerHour: 0,
    salaryBreakup: { pf: 0, esi: 0 },
    otherDeductions: [] as OtherDeduction[],
    pfOpted: false,
    monthlyPfAmount: 0,
    esiOpted: false,
    monthlyEsiAmount: 0,
    role: 'employee' as string,
    documents: [] as { type: string; name?: string; fileUrl: string; uploadedAt: string }[],
  });


  useEffect(() => {
    setPage(1);
  }, [search, includeInactive, filterDepartment]);

  useEffect(() => {
    const editId = searchParams.get('edit');
    if (!editId || editingId === editId) return;
    const e = employees.find((emp: Employee) => emp._id === editId);
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
      employeeId: '',
      name: '',
      contactNumber: '',
      email: '',
      photo: '',
      emergencyNumber: '',
      dateOfBirth: '',
      gender: 'male',
      maritalStatus: '',
      aadhaarNumber: '',
      pfNumber: '',
      esiNumber: '',
      panNumber: '',
      bankName: '',
      bankBranch: '',
      ifscCode: '',
      accountNumber: '',
      upiId: '',
      employeeType: 'full_time',
      branches: [],
      department: '',
      monthlySalary: 0,
      dailySalary: 0,
      overtimeCostPerHour: 0,
      salaryBreakup: { pf: 0, esi: 0 },
      otherDeductions: [],
      pfOpted: false,
      monthlyPfAmount: 0,
      esiOpted: false,
      monthlyEsiAmount: 0,
      role: 'employee',
      documents: [],
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
    const otherDeds = (e as { otherDeductions?: OtherDeduction[] }).otherDeductions ?? [];
    const legacyOther = (e.salaryBreakup as { other?: number } | undefined)?.other ?? 0;
    const hasLegacyOther = legacyOther > 0 && otherDeds.length === 0;
    setForm({
      employeeId: e.employeeId || '',
      name: e.name,
      contactNumber: e.contactNumber,
      email: e.email,
      photo: e.photo || '',
      emergencyNumber: e.emergencyNumber,
      dateOfBirth: e.dateOfBirth ? e.dateOfBirth.slice(0, 10) : '',
      gender: e.gender as 'male' | 'female' | 'other',
      maritalStatus: (e.maritalStatus || '') as '' | 'single' | 'married' | 'other',
      aadhaarNumber: e.aadhaarNumber || '',
      pfNumber: e.pfNumber || '',
      esiNumber: e.esiNumber || '',
      panNumber: e.panNumber || '',
      bankName: e.bankName || '',
      bankBranch: e.bankBranch || '',
      ifscCode: e.ifscCode || '',
      accountNumber: e.accountNumber || '',
      upiId: e.upiId || '',
      employeeType: e.employeeType as 'full_time' | 'contractor',
      branches: (e.branches ?? []).map((b): string => (typeof b === 'object' && b && '_id' in b ? (b as Branch)._id : String(b))),
      department: (e.department && typeof e.department === 'object' && '_id' in e.department ? (e.department as Department)._id : e.department) || '',
      monthlySalary: e.monthlySalary || 0,
      dailySalary: e.dailySalary || 0,
      overtimeCostPerHour: e.overtimeCostPerHour || 0,
      salaryBreakup: {
        pf: e.salaryBreakup?.pf ?? 0,
        esi: e.salaryBreakup?.esi ?? 0,
      },
      otherDeductions: otherDeds.length > 0 ? otherDeds : (hasLegacyOther ? [{ reason: 'Other', amount: legacyOther }] : []),
      documents: (e.documents ?? []).map((d) => ({
        ...d,
        uploadedAt: typeof d.uploadedAt === 'string' ? d.uploadedAt : (d.uploadedAt as Date)?.toISOString?.() ?? '',
      })),
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
        toast.success(t('saveSuccess'));
        await mutateEmployees();
        if (empId && data.employee) {
          const emp = data.employee as Employee;
          setEditingId(empId);
          setForm((f) => ({
            ...f,
            employeeId: emp.employeeId || f.employeeId,
            documents: (emp.documents ?? []).map((d) => ({
              ...d,
              uploadedAt: typeof d.uploadedAt === 'string' ? d.uploadedAt : (d.uploadedAt as Date)?.toISOString?.() ?? '',
            })),
          }));
          setModal('edit');
        } else {
          setModal(null);
        }
        if (data.generatedPassword && data.email && data.contactNumber && data.employeeId) {
          setPasswordModal({
            email: data.email,
            contactNumber: data.contactNumber,
            employeeId: data.employeeId,
            password: data.generatedPassword,
          });
        }
      } else if (editingId) {
        if (photoFile) {
          await uploadPhoto(editingId, photoFile);
        }
        const payload: Record<string, unknown> = {
          ...form,
          dateOfBirth: form.dateOfBirth || undefined,
        };
        // Don't overwrite photo: it's managed by the upload API.
        delete payload.photo;
        // Email, contactNumber, employeeId are immutable - exclude from update
        delete payload.email;
        delete payload.contactNumber;
        delete payload.employeeId;
        const res = await fetch(`/api/employees/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast.success(t('saveSuccess'));
        await mutateEmployees();
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
      const res = await fetch('/api/employees/import-template');
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'employees_import_template.xlsx';
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
      const res = await fetch('/api/employees/import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      const msg = `${data.created} ${t('employees')} imported`;
      toast.success(data.errors?.length ? `${msg} (${data.errors.length} errors)` : msg);
      setImportModal(false);
      setImportFile(null);
      await mutateEmployees();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setImporting(false);
    }
  };

  const handleToggleActive = (e: Employee) => {
    setConfirmModal({
      message: e.isActive ? t('confirmMakeInactive') : t('confirmMakeActive'),
      confirmLabel: e.isActive ? t('makeInactive') : t('makeActive'),
      variant: 'warning',
      onConfirm: async () => {
        const res = await fetch(`/api/employees/${e._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !e.isActive }),
        });
        if (!res.ok) throw new Error();
        toast.success(t('saveSuccess'));
        mutateEmployees();
      },
    });
  };

  const copyCredentials = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const filteredEmployees = Array.isArray(employees) ? employees : [];
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

  const otherTotal = form.otherDeductions.reduce((s, d) => s + (d.amount || 0), 0);
  const hasMonthly = (form.monthlySalary || 0) > 0;
  const hasDaily = (form.dailySalary || 0) > 0;
  const salaryValid = form.employeeType === 'contractor' || hasMonthly !== hasDaily;
  const otValid = form.employeeType !== 'full_time' || (form.overtimeCostPerHour || 0) > 0;
  const pfValid = !form.pfOpted || (form.employeeType === 'contractor' ? (form.monthlyPfAmount || 0) > 0 : (form.salaryBreakup?.pf ?? 0) > 0) && !!form.pfNumber?.trim();
  const esiValid = !form.esiOpted || (form.employeeType === 'contractor' ? (form.monthlyEsiAmount || 0) > 0 : (form.salaryBreakup?.esi ?? 0) > 0) && !!form.esiNumber?.trim();
  const canSave = !saving && !!form.name && !!form.contactNumber && !!form.email && !!form.emergencyNumber && !!form.dateOfBirth && form.branches.length > 0 && !!form.department && salaryValid && otValid && pfValid && esiValid;

  /* Full-screen add/edit form */
  if (modal) {
    return (
      <div className="flex flex-col h-full min-h-[calc(100vh-12rem)]">
        {/* Sticky block: breadcrumb + form header — sticks below dashboard header (h-14) */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm -mx-4 -mt-6 px-4 pt-6 sm:-mx-6 sm:-mt-8 sm:px-6 sm:pt-8 lg:-mx-8 lg:-mt-8 lg:px-8 lg:pt-8">
          <div className="pb-2">
            <Breadcrumb
              items={[
                { label: t('employees'), onClick: closeForm },
                { label: modal === 'create' ? t('add') : modal === 'view' ? t('view') : t('edit') },
              ]}
            />
          </div>
          <div className="flex items-center justify-between gap-4 py-4">
            <h1 className="text-xl font-semibold text-slate-900 truncate">
              {modal === 'create' ? t('add') : modal === 'view' ? t('view') : t('edit')} {t('employees')}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
            {modal !== 'view' && (
              <button
                onClick={handleSave}
                disabled={!canSave}
                className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50"
              >
                {saving ? '...' : t('save')}
              </button>
            )}
            {modal === 'view' && editingId && canAdd && (
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

        <div className="flex-1 overflow-y-auto px-1">
          <div className="max-w-5xl space-y-8">
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

            <FormSection title={t('selectBranches') + ' & ' + t('department')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField label={t('selectBranches')} required>
                  {branches.length === 0 && (
                    <p className="text-uff-accent text-sm mb-2">{t('addBranchFirst')}</p>
                  )}
                  <MultiselectDropdown
                    options={Array.isArray(branches) ? branches : []}
                    selectedIds={form.branches}
                    onChange={(ids) => setForm((f) => ({ ...f, branches: ids }))}
                    placeholder={t('selectBranches')}
                    label={undefined}
                    disabled={modal === 'view'}
                    selectAllLabel={t('selectAll')}
                    searchPlaceholder={t('search')}
                  />
                </FormField>
                <FormField label={t('selectDepartment')} required>
                  <select
                    value={form.department}
                    onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
                    disabled={modal === 'view'}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                  >
                    <option value="">—</option>
                    {(Array.isArray(departments) ? departments : []).map((d: Department) => (
                      <option key={d._id} value={d._id}>{d.name}</option>
                    ))}
                  </select>
                </FormField>
              </div>
            </FormSection>

            <FormSection title={t('employeeName') + ' & ' + t('contactNumber')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <FormField label={t('employeeId')}>
                  <div className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-slate-50 font-mono font-semibold text-slate-800 cursor-not-allowed">
                    {form.employeeId || '—'}
                  </div>
                </FormField>
                <FormField label={t('employeeName')} required>
                  <ValidatedInput
                    type="text"
                    value={form.name}
                    onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                    fieldType="name"
                    readOnly={modal === 'view'}
                  />
                </FormField>
                <FormField label={t('contactNumber')} required>
                  <ValidatedInput
                    type="tel"
                    value={form.contactNumber}
                    onChange={(v) => setForm((f) => ({ ...f, contactNumber: v }))}
                    fieldType="phone"
                    readOnly={modal === 'edit' || modal === 'view'}
                  />
                </FormField>
                <FormField label={t('email')} required>
                  <ValidatedInput
                    type="email"
                    value={form.email}
                    onChange={(v) => setForm((f) => ({ ...f, email: v }))}
                    fieldType="email"
                    readOnly={modal === 'edit' || modal === 'view'}
                  />
                </FormField>
                <FormField label={t('emergencyNumber')} required>
                  <ValidatedInput
                    type="tel"
                    value={form.emergencyNumber}
                    onChange={(v) => setForm((f) => ({ ...f, emergencyNumber: v }))}
                    fieldType="phone"
                    readOnly={modal === 'view'}
                  />
                </FormField>
                <FormField label={t('dateOfBirth')} required>
                  <ValidatedInput
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(v) => setForm((f) => ({ ...f, dateOfBirth: v }))}
                    fieldType="date"
                    readOnly={modal === 'view'}
                  />
                </FormField>
                <FormField label={t('gender')} required>
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
                </FormField>
                <FormField label={t('maritalStatus')}>
                  <select
                    value={form.maritalStatus}
                    onChange={(e) => setForm((f) => ({ ...f, maritalStatus: e.target.value as '' | 'single' | 'married' | 'other' }))}
                    disabled={modal === 'view'}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                  >
                    <option value="">—</option>
                    <option value="single">{t('single')}</option>
                    <option value="married">{t('married')}</option>
                    <option value="other">{t('other')}</option>
                  </select>
                </FormField>
                <FormField label={t('employeeType')} required>
                  <select
                    value={form.employeeType}
                    onChange={(e) => setForm((f) => ({ ...f, employeeType: e.target.value as 'full_time' | 'contractor' }))}
                    disabled={modal === 'view'}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : 'focus:ring-2 focus:ring-uff-accent'}`}
                  >
                    <option value="full_time">{t('fullTime')}</option>
                    <option value="contractor">{t('contractor')}</option>
                  </select>
                </FormField>
                {modal === 'create' && (
                  <FormField label={t('role')}>
                    <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent">
                      <option value="employee">{t('employee')}</option>
                      {user?.role === 'admin' && (
                        <>
                          <option value="hr">{t('hr')}</option>
                          <option value="finance">{t('finance')}</option>
                          <option value="accountancy">{t('accountancy')}</option>
                          <option value="admin">{t('admin')}</option>
                        </>
                      )}
                    </select>
                  </FormField>
                )}
              </div>
            </FormSection>

            {/* PF & ESI - nice card section for both full-time and contractor */}
            <FormSection title={t('pf') + ' & ' + t('esi')}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.pfOpted} onChange={(e) => setForm((f) => ({ ...f, pfOpted: e.target.checked }))} disabled={modal === 'view'} className="rounded border-slate-400" />
                    <span className="font-medium text-slate-800">{t('applicable')} — {t('pf')}</span>
                  </label>
                  {form.pfOpted && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                      <FormField label={t('pfNumber')} required>
                        <ValidatedInput type="text" value={form.pfNumber || ''} onChange={(v) => setForm((f) => ({ ...f, pfNumber: v }))} fieldType="pfNumber" readOnly={modal === 'view'} />
                      </FormField>
                      <FormField label={`${form.employeeType === 'contractor' ? t('monthlyPfAmount') : t('pf')} (₹)`} required>
                        <ValidatedInput
                          type="number"
                          min={0}
                          step={0.01}
                          value={String(form.employeeType === 'contractor' ? (form.monthlyPfAmount ?? '') : (form.salaryBreakup?.pf ?? ''))}
                          onChange={(v) => setForm((f) => ({
                            ...f,
                            ...(f.employeeType === 'contractor' ? { monthlyPfAmount: parseFloat(v) || 0 } : { salaryBreakup: { ...f.salaryBreakup, pf: parseFloat(v) || 0 } }),
                          }))}
                          fieldType="number"
                          placeholderHint={form.employeeType === 'contractor' ? 'e.g. 500' : 'e.g. 2100'}
                          readOnly={modal === 'view'}
                        />
                      </FormField>
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.esiOpted} onChange={(e) => setForm((f) => ({ ...f, esiOpted: e.target.checked }))} disabled={modal === 'view'} className="rounded border-slate-400" />
                    <span className="font-medium text-slate-800">{t('applicable')} — {t('esi')}</span>
                  </label>
                  {form.esiOpted && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
                      <FormField label={t('esiNumber')} required>
                        <ValidatedInput type="text" value={form.esiNumber || ''} onChange={(v) => setForm((f) => ({ ...f, esiNumber: v }))} fieldType="esiNumber" readOnly={modal === 'view'} />
                      </FormField>
                      <FormField label={`${form.employeeType === 'contractor' ? t('monthlyEsiAmount') : t('esi')} (₹)`} required>
                        <ValidatedInput
                          type="number"
                          min={0}
                          step={0.01}
                          value={String(form.employeeType === 'contractor' ? (form.monthlyEsiAmount ?? '') : (form.salaryBreakup?.esi ?? ''))}
                          onChange={(v) => setForm((f) => ({
                            ...f,
                            ...(f.employeeType === 'contractor' ? { monthlyEsiAmount: parseFloat(v) || 0 } : { salaryBreakup: { ...f.salaryBreakup, esi: parseFloat(v) || 0 } }),
                          }))}
                          fieldType="number"
                          placeholderHint={form.employeeType === 'contractor' ? 'e.g. 200' : 'e.g. 525'}
                          readOnly={modal === 'view'}
                        />
                      </FormField>
                    </div>
                  )}
                </div>
              </div>
            </FormSection>

            {/* Full-time: Salary (monthly OR daily) + OT cost */}
            {form.employeeType === 'full_time' && (
              <FormSection title={t('salaryBreakup')}>
                <p className="text-sm text-slate-600 mb-4">{t('salaryBasis')}: Enter either {t('salaryBasisMonthly')} or {t('salaryBasisDaily')} (not both)</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField label={`${t('monthlySalary')} (₹)`}>
                    <ValidatedInput
                      type="number"
                      min={0}
                      step={0.01}
                      value={hasMonthly ? String(form.monthlySalary) : ''}
                      onChange={(v) => setForm((f) => {
                        const val = parseFloat(v) || 0;
                        return { ...f, monthlySalary: val, dailySalary: val > 0 ? 0 : f.dailySalary };
                      })}
                      fieldType="number"
                      placeholderHint="e.g. 35000"
                      readOnly={modal === 'view'}
                    />
                  </FormField>
                  <FormField label={`${t('dailySalary')} (₹)`}>
                    <ValidatedInput
                      type="number"
                      min={0}
                      step={0.01}
                      value={hasDaily ? String(form.dailySalary) : ''}
                      onChange={(v) => setForm((f) => {
                        const val = parseFloat(v) || 0;
                        return { ...f, dailySalary: val, monthlySalary: val > 0 ? 0 : f.monthlySalary };
                      })}
                      fieldType="number"
                      placeholderHint="e.g. 1500"
                      readOnly={modal === 'view'}
                    />
                  </FormField>
                </div>
                <FormField label={`${t('overtimeCostPerHour')} (₹)`} required>
                  <ValidatedInput
                    type="number"
                    min={0}
                    step={0.01}
                    value={String(form.overtimeCostPerHour ?? '')}
                    onChange={(v) => setForm((f) => ({ ...f, overtimeCostPerHour: parseFloat(v) || 0 }))}
                    fieldType="number"
                    placeholderHint="e.g. 80"
                    readOnly={modal === 'view'}
                  />
                </FormField>
                <p className="text-xs text-slate-500 mt-1">{t('overtimeCostPerHourHint')}</p>
                {((form.monthlySalary || 0) > 0 || (form.dailySalary || 0) > 0) && (
                  <p className="text-sm text-slate-700 mt-2">
                    {t('netSalary')} (approx): ₹{formatAmount(
                      (form.monthlySalary || 0) + (form.dailySalary || 0) * 26 - (form.pfOpted ? (form.salaryBreakup?.pf || 0) : 0) - (form.esiOpted ? (form.salaryBreakup?.esi || 0) : 0) - otherTotal
                    )}
                  </p>
                )}
              </FormSection>
            )}

            {/* Other deductions - multiple with add/remove */}
            <FormSection title={t('otherDeductions')}>
              <div className="space-y-3">
                {form.otherDeductions.map((d, idx) => (
                  <div key={idx} className="flex gap-3 items-end">
                    <div className="flex-1 min-w-0">
                    <FormField label={t('reasonForDeduction')}>
                      <ValidatedInput
                        type="text"
                        value={d.reason}
                        onChange={(v) => setForm((f) => ({
                          ...f,
                          otherDeductions: f.otherDeductions.map((x, i) => i === idx ? { ...x, reason: v } : x),
                        }))}
                        fieldType="text"
                        placeholderHint="e.g. Loan recovery"
                        readOnly={modal === 'view'}
                      />
                    </FormField>
                    </div>
                    <div className="w-32 shrink-0">
                    <FormField label={`${t('amount')} (₹)`}>
                      <ValidatedInput
                        type="number"
                        min={0}
                        step={0.01}
                        value={String(d.amount || '')}
                        onChange={(v) => setForm((f) => ({
                          ...f,
                          otherDeductions: f.otherDeductions.map((x, i) => i === idx ? { ...x, amount: parseFloat(v) || 0 } : x),
                        }))}
                        fieldType="number"
                        readOnly={modal === 'view'}
                      />
                    </FormField>
                    </div>
                    {modal !== 'view' && (
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, otherDeductions: f.otherDeductions.filter((_, i) => i !== idx) }))}
                        className="shrink-0 p-2 rounded-lg text-red-600 hover:bg-red-50"
                        aria-label={t('removeDeduction')}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    )}
                  </div>
                ))}
                {modal !== 'view' && (
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, otherDeductions: [...f.otherDeductions, { reason: '', amount: 0 }] }))}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    {t('addDeduction')}
                  </button>
                )}
                {otherTotal > 0 && <p className="text-sm text-slate-600">Total: ₹{formatAmount(otherTotal)}</p>}
              </div>
            </FormSection>

            <FormSection title={t('aadhaarNumber') + ' / ' + t('panNumber')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <FormField label={t('aadhaarNumber')}>
                  <ValidatedInput
                    type="text"
                    value={form.aadhaarNumber || ''}
                    onChange={(v) => setForm((f) => ({ ...f, aadhaarNumber: v }))}
                    fieldType="aadhaar"
                    readOnly={modal === 'view'}
                  />
                </FormField>
                <FormField label={t('panNumber')}>
                  <ValidatedInput
                    type="text"
                    value={form.panNumber || ''}
                    onChange={(v) => setForm((f) => ({ ...f, panNumber: v.toUpperCase() }))}
                    fieldType="pan"
                    readOnly={modal === 'view'}
                  />
                </FormField>
              </div>
            </FormSection>

            <FormSection title={t('bankingDetails')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                <FormField label={t('bankName')}>
                  <ValidatedInput
                    type="text"
                    value={form.bankName || ''}
                    onChange={(v) => setForm((f) => ({ ...f, bankName: v }))}
                    fieldType="bankName"
                    placeholderHint="e.g. State Bank of India"
                    readOnly={modal === 'view'}
                  />
                </FormField>
                <FormField label={t('bankBranch')}>
                  <ValidatedInput
                    type="text"
                    value={form.bankBranch || ''}
                    onChange={(v) => setForm((f) => ({ ...f, bankBranch: v }))}
                    fieldType="text"
                    placeholderHint="e.g. Main Branch, Bangalore"
                    readOnly={modal === 'view'}
                  />
                </FormField>
                <FormField label={t('ifscCode')}>
                  <ValidatedInput
                    type="text"
                    value={form.ifscCode || ''}
                    onChange={(v) => setForm((f) => ({ ...f, ifscCode: v.toUpperCase() }))}
                    fieldType="ifsc"
                    maxLength={11}
                    readOnly={modal === 'view'}
                  />
                </FormField>
                <FormField label={t('accountNumber')}>
                  <ValidatedInput
                    type="text"
                    value={form.accountNumber || ''}
                    onChange={(v) => setForm((f) => ({ ...f, accountNumber: v.replace(/\D/g, '') }))}
                    fieldType="accountNumber"
                    readOnly={modal === 'view'}
                  />
                </FormField>
                <FormField label={t('upiId')}>
                  <ValidatedInput
                    type="text"
                    value={form.upiId || ''}
                    onChange={(v) => setForm((f) => ({ ...f, upiId: v }))}
                    fieldType="upi"
                    readOnly={modal === 'view'}
                  />
                </FormField>
              </div>
            </FormSection>

            {editingId && (
              <FormSection title={t('documents')}>
                <EmployeeDocuments
                  documents={form.documents ?? []}
                  employeeId={editingId}
                  canUpload={modal !== 'view' && !!user && ['admin', 'finance', 'hr'].includes(user.role)}
                  onUploadSuccess={async () => {
                    const r = await fetch(`/api/employees/${editingId}`);
                    const emp = await r.json();
                    if (emp?.documents) setForm((f) => ({ ...f, documents: emp.documents }));
                  }}
                  uploadEndpoint={`/api/employees/${editingId}/documents`}
                />
              </FormSection>
            )}

          </div>
        </div>

        {passwordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-lg font-semibold text-uff-accent mb-2">{t('loginCredentials')}</h2>
              <p className="text-slate-600 text-sm mb-4">Save these credentials securely. The password will not be shown again.</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg">
                  <div>
                    <span className="text-xs font-medium text-slate-500 uppercase">{t('email')}</span>
                    <p className="font-mono text-sm break-all">{passwordModal.email}</p>
                  </div>
                  <button onClick={() => copyCredentials(passwordModal.email)} className="shrink-0 px-2 py-1 rounded bg-uff-accent text-uff-primary text-xs">{t('copy')}</button>
                </div>
                <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg">
                  <div>
                    <span className="text-xs font-medium text-slate-500 uppercase">{t('contactNumber')}</span>
                    <p className="font-mono text-sm">{passwordModal.contactNumber}</p>
                  </div>
                  <button onClick={() => copyCredentials(passwordModal.contactNumber)} className="shrink-0 px-2 py-1 rounded bg-uff-accent text-uff-primary text-xs">{t('copy')}</button>
                </div>
                <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg">
                  <div>
                    <span className="text-xs font-medium text-slate-500 uppercase">{t('employeeId')}</span>
                    <p className="font-mono text-sm font-semibold">{passwordModal.employeeId}</p>
                  </div>
                  <button onClick={() => copyCredentials(passwordModal.employeeId)} className="shrink-0 px-2 py-1 rounded bg-uff-accent text-uff-primary text-xs">{t('copy')}</button>
                </div>
                <div className="flex items-center justify-between gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div>
                    <span className="text-xs font-medium text-amber-700 uppercase">{t('password')}</span>
                    <p className="font-mono text-sm break-all">{passwordModal.password}</p>
                  </div>
                  <button onClick={() => copyCredentials(passwordModal.password)} className="shrink-0 px-2 py-1 rounded bg-uff-accent text-uff-primary text-xs">{t('copyPassword')}</button>
                </div>
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
            disabled={branches.length === 0}
            className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title={!Array.isArray(branches) || branches.length === 0 ? t('addBranchFirst') : ''}
          >
            {t('add')} {t('employees')}
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
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">{t('filterByBranch')}</label>
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
          >
            <option value="">{t('all')}</option>
            {(Array.isArray(branches) ? branches : []).map((b: Branch) => (
              <option key={b._id} value={b._id}>{b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">{t('department')}</label>
          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
          >
            <option value="">{t('all')}</option>
            {(Array.isArray(departments) ? departments : []).map((d: Department) => (
              <option key={d._id} value={d._id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">{t('filterByType')}</label>
          <select
            value={filterEmployeeType}
            onChange={(e) => setFilterEmployeeType(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
          >
            <option value="">{t('all')}</option>
            <option value="full_time">{t('fullTime')}</option>
            <option value="contractor">{t('contractor')}</option>
          </select>
        </div>
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
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('employeeId')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('employeeName')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('contactNumber')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('department')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('branches')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('employeeType')}</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('status')}</th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {sortedEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-600">
                      {t('noData')}
                    </td>
                  </tr>
                ) : (
                  sortedEmployees.map((e) => (
                    <tr key={e._id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-medium text-slate-700">{e.employeeId || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <UserAvatar photo={e.photo} name={e.name} size="sm" className="w-8 h-8 shrink-0" />
                          <span className="text-slate-800">{e.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{e.contactNumber}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {e.department && typeof e.department === 'object' && 'name' in e.department ? (e.department as Department).name : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-700 text-sm">
                        {Array.isArray(e.branches) && e.branches.length > 0
                          ? e.branches.map((b: Branch | string) => (typeof b === 'object' && b && 'name' in b ? (b as Branch).name : b)).join(', ')
                          : '—'}
                      </td>
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
                          onEdit={canAdd ? () => openEdit(e) : undefined}
                          onToggleActive={canAdd ? () => handleToggleActive(e) : undefined}
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
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${e.isActive ? 'bg-green-100 text-green-800' : 'bg-slate-200 text-slate-700'}`}>
                        {e.isActive ? t('active') : t('inactive')}
                      </span>
                      <span className="text-xs text-slate-500">
                        {e.employeeType === 'full_time' ? t('fullTime') : t('contractor')}
                      </span>
                      {e.department && typeof e.department === 'object' && 'name' in e.department && (
                        <span className="text-xs text-slate-500">
                          • {(e.department as Department).name}
                        </span>
                      )}
                      {Array.isArray(e.branches) && e.branches.length > 0 && (
                        <span className="text-xs text-slate-500">
                          • {e.branches.map((b: Branch | string) => (typeof b === 'object' && b && 'name' in b ? (b as Branch).name : b)).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <ActionButtons
                    onView={() => openView(e)}
                    onEdit={canAdd ? () => openEdit(e) : undefined}
                    onToggleActive={canAdd ? () => handleToggleActive(e) : undefined}
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

      {sortedEmployees.length > 0 && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>
            {t('showing') || 'Showing'} {(page - 1) * limit + 1}–{Math.min(page * limit, total)} {t('of') || 'of'} {total}
          </span>
          {hasMore && (
            <button
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium"
            >
              {t('loadMore')}
            </button>
          )}
        </div>
      )}

      {passwordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-uff-accent mb-2">{t('loginCredentials')}</h2>
            <p className="text-slate-600 text-sm mb-4">Save these credentials securely. The password will not be shown again.</p>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">{t('email')}</span>
                  <p className="font-mono text-sm break-all">{passwordModal.email}</p>
                </div>
                <button onClick={() => copyCredentials(passwordModal.email)} className="shrink-0 px-2 py-1 rounded bg-uff-accent text-uff-primary text-xs">{t('copy')}</button>
              </div>
              <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">{t('contactNumber')}</span>
                  <p className="font-mono text-sm">{passwordModal.contactNumber}</p>
                </div>
                <button onClick={() => copyCredentials(passwordModal.contactNumber)} className="shrink-0 px-2 py-1 rounded bg-uff-accent text-uff-primary text-xs">{t('copy')}</button>
              </div>
              <div className="flex items-center justify-between gap-2 p-3 bg-slate-50 rounded-lg">
                <div>
                  <span className="text-xs font-medium text-slate-500 uppercase">{t('employeeId')}</span>
                  <p className="font-mono text-sm font-semibold">{passwordModal.employeeId}</p>
                </div>
                <button onClick={() => copyCredentials(passwordModal.employeeId)} className="shrink-0 px-2 py-1 rounded bg-uff-accent text-uff-primary text-xs">{t('copy')}</button>
              </div>
              <div className="flex items-center justify-between gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div>
                  <span className="text-xs font-medium text-amber-700 uppercase">{t('password')}</span>
                  <p className="font-mono text-sm break-all">{passwordModal.password}</p>
                </div>
                <button onClick={() => copyCredentials(passwordModal.password)} className="shrink-0 px-2 py-1 rounded bg-uff-accent text-uff-primary text-xs">{t('copyPassword')}</button>
              </div>
            </div>
            <button onClick={() => setPasswordModal(null)} className="mt-4 w-full py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white">{t('close')}</button>
          </div>
        </div>
      )}

      <ImportModal
        open={importModal}
        onClose={() => { setImportModal(false); setImportFile(null); }}
        title={`${t('importFromExcel')} - ${t('employees')}`}
        onDownloadTemplate={handleDownloadTemplate}
        downloadLabel={t('downloadTemplate')}
        instructions={<p>Columns: Employee ID, Name, Contact, Email, Emergency, DOB, Gender, Marital Status, Employee Type, Branch, Department, Salary, PF/ESI Opted, Bank details. Use dropdowns for Gender, Type, Branch, Department.</p>}
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
