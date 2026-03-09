'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import ActionButtons from '@/components/ActionButtons';
import { PageLoader, Skeleton } from '@/components/Skeleton';
import { useEmployees, useBranches, useDepartments, useRates, useWorkRecords, useStyleOrdersByBranchMonth } from '@/lib/hooks/useApi';
import ValidatedInput from '@/components/ValidatedInput';
import { formatMonth, formatAmount } from '@/lib/utils';
import ConfirmModal from '@/components/ConfirmModal';
import Modal from '@/components/Modal';
import SaveOverlay from '@/components/SaveOverlay';
import { toast } from '@/lib/toast';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface Branch {
  _id: string;
  name: string;
}

interface Employee {
  _id: string;
  name: string;
  employeeType: string;
  branches: Branch[] | { _id: string }[];
  department?: { _id: string; name: string } | string;
}

interface RateMaster {
  _id: string;
  name: string;
  unit: string;
  amountForBranch?: number;
}

interface StyleOrderWithAvailability {
  _id: string;
  styleCode: string;
  monthData?: {
    entries: { rateMasterId: string; totalOrderQuantity: number; availableQuantity: number; sellingPricePerQuantity?: number }[];
  } | null;
}

interface WorkItem {
  rateMaster?: unknown;
  rateMasterId?: string;
  rateName: string;
  unit: string;
  quantity: number;
  ratePerUnit: number;
  amount: number;
}

interface WorkRecord {
  _id: string;
  employee: { name: string };
  branch: { name: string };
  month: string;
  styleOrder?: { styleCode: string } | null;
  workItems: WorkItem[];
  otHours?: number;
  otAmount?: number;
  totalAmount: number;
}

export default function WorkRecordsPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const isEmployee = !!user?.employeeId;
  const canAccess = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '') || isEmployee;
  const [filterEmployee, setFilterEmployee] = useState(isEmployee && user?.employeeId ? user.employeeId : '');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    employeeId: '',
    employeeName: '',
    branchId: '',
    branchName: '',
    departmentId: '',
    departmentName: '',
    month: '',
    styleOrderId: '',
    styleOrderCode: '',
    workItems: {} as Record<string, { quantity: number; defaultQuantity: number; ratePerUnit: number; defaultRatePerUnit: number; remarks: string }>,
    otHours: 0,
    otAmount: 0,
    notes: '',
  });

  const { employees: empList } = useEmployees(false, { limit: 0, departmentId: filterDepartment || undefined });
  const employees = (Array.isArray(empList) ? empList : []).filter((e: Employee) => e.employeeType === 'contractor');
  const { employees: formEmpList } = useEmployees(false, {
    limit: 0,
    branchId: form.branchId || undefined,
    departmentId: form.departmentId || undefined,
  });
  const employeesForBranchAndDepartment = (Array.isArray(formEmpList) ? formEmpList : []).filter((e: Employee) => e.employeeType === 'contractor');
  const { branches } = useBranches(false);
  const { departments } = useDepartments(true);
  const { records, total, limit, hasMore, loading, mutate: mutateRecords } = useWorkRecords(
    { employeeId: filterEmployee || undefined, branchId: filterBranch || undefined, departmentId: filterDepartment || undefined, month: filterMonth || undefined, page, limit: 50 },
    canAccess
  );
  const canAdd = ['admin', 'finance', 'hr'].includes(user?.role || '');
  const [confirmModal, setConfirmModal] = useState<{ message: string; confirmLabel: string; variant: 'danger' | 'warning'; onConfirm: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (isEmployee && user?.employeeId) {
      setFilterEmployee(user.employeeId);
    }
  }, [isEmployee, user?.employeeId]);

  useEffect(() => {
    if (!isEmployee && employees.length === 1 && !filterEmployee) {
      setFilterEmployee(employees[0]._id);
    }
  }, [isEmployee, employees, filterEmployee]);

  useEffect(() => {
    if (Array.isArray(branches) && branches.length === 1 && !filterBranch) {
      setFilterBranch(branches[0]._id);
    }
  }, [branches, filterBranch]);

  useEffect(() => {
    setPage(1);
  }, [filterEmployee, filterBranch, filterDepartment, filterMonth]);

  const { rates } = useRates(true, form.branchId || undefined);
  const { styleOrders: stylesForForm } = useStyleOrdersByBranchMonth(form.branchId || undefined, form.month || undefined, !!(form.branchId && form.month));

  const [modal, setModal] = useState<'create' | 'edit' | 'view' | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('month-desc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');

  const openCreate = () => {
    if (!Array.isArray(employees) || employees.length === 0) {
      toast.error(t('noContractors'));
      return;
    }
    setForm({
      employeeId: '',
      employeeName: '',
      branchId: '',
      branchName: '',
      departmentId: '',
      departmentName: '',
      month: getCurrentMonth(),
      styleOrderId: '',
      styleOrderCode: '',
      workItems: {},
      otHours: 0,
      otAmount: 0,
      notes: '',
    });
    setModal('create');
    setEditingId(null);
  };

  const openEdit = (r: WorkRecord) => {
    const emp = r.employee as { _id?: string; name?: string };
    const br = r.branch as { _id?: string; name?: string };
    const style = r.styleOrder as { _id?: string; styleCode?: string } | undefined;
    const rec = r as { employee?: { department?: { _id?: string; name?: string } } };
    const empDept = rec.employee && typeof rec.employee === 'object' && (rec.employee as { department?: { _id?: string; name?: string } }).department;
    const workItemsRecord: Record<string, { quantity: number; defaultQuantity: number; ratePerUnit: number; defaultRatePerUnit: number; remarks: string }> = {};
    for (const wi of r.workItems || []) {
      const id = String(wi.rateMaster ?? (wi as { rateMasterId?: string }).rateMasterId ?? '');
      const qty = Math.max(1, wi.quantity || 1);
      const rate = Math.max(0, wi.ratePerUnit || 0);
      if (id) workItemsRecord[id] = { quantity: qty, defaultQuantity: qty, ratePerUnit: rate, defaultRatePerUnit: rate, remarks: (wi as { remarks?: string }).remarks ?? '' };
    }
    setForm({
      employeeId: emp?._id || String(r.employee) || '',
      employeeName: typeof emp === 'object' && emp?.name ? emp.name : '',
      branchId: br?._id || String(r.branch) || '',
      branchName: typeof br === 'object' && br?.name ? br.name : '',
      departmentId: empDept && typeof empDept === 'object' ? (empDept as { _id?: string })._id || '' : '',
      departmentName: empDept && typeof empDept === 'object' ? (empDept as { name?: string }).name || '' : '',
      month: (r as { month?: string }).month || '',
      styleOrderId: style?._id || '',
      styleOrderCode: (style as { brand?: string })?.brand ? `${(style as { styleCode?: string })?.styleCode || ''} - ${(style as { brand?: string })?.brand}` : style?.styleCode || '',
      workItems: workItemsRecord,
      otHours: (r as { otHours?: number }).otHours ?? 0,
      otAmount: (r as { otAmount?: number }).otAmount ?? 0,
      notes: '',
    });
    setModal('edit');
    setEditingId(r._id);
  };

  const openView = (r: WorkRecord) => {
    openEdit(r);
    setModal('view');
  };

  const selectedStyle = stylesForForm?.find((s: { _id: string }) => s._id === form.styleOrderId) as StyleOrderWithAvailability | undefined;
  const getDefaultQuantity = (rateMasterId: string) => {
    const entry = selectedStyle?.monthData?.entries?.find((e: { rateMasterId: string; availableQuantity?: number }) => e.rateMasterId === rateMasterId);
    return entry?.availableQuantity ?? 0;
  };

  useEffect(() => {
    if (!modal || modal === 'view') return;
    const brs = Array.isArray(branches) ? branches : [];
    if (brs.length === 1 && !form.branchId) {
      const b = brs[0];
      setForm((f) => ({ ...f, branchId: b._id, branchName: b.name, departmentId: '', departmentName: '', employeeId: '', employeeName: '', styleOrderId: '', styleOrderCode: '', workItems: {} }));
    }
  }, [modal, branches, form.branchId]);

  useEffect(() => {
    if (!modal || modal === 'view' || !form.branchId) return;
    if (employeesForBranchAndDepartment.length === 1 && !form.employeeId) {
      const emp = employeesForBranchAndDepartment[0];
      setForm((f) => ({ ...f, employeeId: emp._id, employeeName: emp.name }));
    }
  }, [modal, form.branchId, form.employeeId, employeesForBranchAndDepartment]);

  useEffect(() => {
    if (!modal || modal === 'view' || !form.branchId || !form.month) return;
    const styles = Array.isArray(stylesForForm) ? stylesForForm : [];
    if (styles.length === 1 && !form.styleOrderId) {
      const s = styles[0];
      const display = (s as { brand?: string }).brand ? `${(s as { styleCode?: string }).styleCode || ''} - ${(s as { brand?: string }).brand}` : (s as { styleCode?: string }).styleCode || '';
      setForm((f) => ({ ...f, styleOrderId: s._id, styleOrderCode: display, workItems: {} }));
    }
  }, [modal, form.branchId, form.month, form.styleOrderId, stylesForForm]);

  const toggleRateChecked = (rateMasterId: string, checked: boolean) => {
    if (!rates?.length || !form.branchId) return;
    const rate = rates.find((r: RateMaster) => r._id === rateMasterId);
    if (!rate) return;
    if (checked) {
      const defaultQty = Math.max(1, getDefaultQuantity(rateMasterId));
      setForm((f) => ({
        ...f,
        workItems: {
          ...f.workItems,
          [rateMasterId]: { quantity: defaultQty, defaultQuantity: defaultQty, ratePerUnit: Math.max(0, rate.amountForBranch ?? 0), defaultRatePerUnit: Math.max(0, rate.amountForBranch ?? 0), remarks: '' },
        },
      }));
    } else {
      setForm((f) => {
        const next = { ...f.workItems };
        delete next[rateMasterId];
        return { ...f, workItems: next };
      });
    }
  };

  const updateWorkItemField = (rateMasterId: string, field: 'quantity' | 'ratePerUnit' | 'remarks', value: number | string) => {
    setForm((f) => {
      const item = f.workItems[rateMasterId];
      if (!item) return f;
      const next = { ...f.workItems };
      if (field === 'quantity') next[rateMasterId] = { ...item, quantity: Math.max(1, Number(value) || 1) };
      else if (field === 'ratePerUnit') next[rateMasterId] = { ...item, ratePerUnit: Math.max(0, Number(value) || 0) };
      else next[rateMasterId] = { ...item, [field]: value };
      return { ...f, workItems: next };
    });
  };

  const workTotal = Object.entries(form.workItems).reduce(
    (sum, [, wi]) => sum + (wi.quantity || 0) * (wi.ratePerUnit || 0),
    0
  );
  const totalAmount = workTotal + (form.otAmount ?? 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const workItemsArray = Object.entries(form.workItems)
        .filter(([, wi]) => (wi.quantity || 0) > 0)
        .map(([rateMasterId, wi]) => {
          const needsRemarks = wi.ratePerUnit !== wi.defaultRatePerUnit;
          if (needsRemarks && !(wi.remarks || '').trim()) {
            throw new Error(t('remarksRequiredWhenRateChanged'));
          }
          return { rateMasterId, quantity: wi.quantity, multiplier: 1, remarks: wi.remarks ?? '', ratePerUnit: wi.ratePerUnit };
        });

      const payload = {
        employeeId: form.employeeId,
        branchId: form.branchId,
        month: form.month,
        styleOrderId: form.styleOrderId || undefined,
        workItems: workItemsArray,
        otHours: form.otHours ?? 0,
        otAmount: form.otAmount ?? 0,
        notes: form.notes,
      };

      if (modal === 'create') {
        const res = await fetch('/api/work-records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        toast.success(t('saveSuccess'));
        await mutateRecords();
        setModal(null);
      } else if (editingId) {
        const res = await fetch(`/api/work-records/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        toast.success(t('saveSuccess'));
        await mutateRecords();
        setModal(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id: string) => {
    setConfirmModal({
      message: t('confirmDelete'),
      confirmLabel: t('delete'),
      variant: 'danger',
      onConfirm: async () => {
        const res = await fetch(`/api/work-records/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error();
        toast.success(t('saveSuccess'));
        mutateRecords();
      },
    });
  };

  const filtered = (Array.isArray(records) ? records : []).filter((r) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const empName = (r.employee as { name?: string })?.name || '';
    const branchName = (r.branch as { name?: string })?.name || '';
    const so = r.styleOrder as { styleCode?: string; brand?: string } | undefined;
    const styleCode = so ? (so.brand ? `${so.styleCode || ''} - ${so.brand}` : so.styleCode || '') : '';
    return empName.toLowerCase().includes(q) || branchName.toLowerCase().includes(q) || styleCode.toLowerCase().includes(q);
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'amount-asc') return (a.totalAmount || 0) - (b.totalAmount || 0);
    if (sortBy === 'amount-desc') return (b.totalAmount || 0) - (a.totalAmount || 0);
    if (sortBy === 'month-asc') return ((a as { month?: string }).month || '').localeCompare((b as { month?: string }).month || '');
    return ((b as { month?: string }).month || '').localeCompare((a as { month?: string }).month || '');
  });
  const SORT_OPTIONS = [
    { value: 'month-desc', label: `${t('month')} (newest)` },
    { value: 'month-asc', label: `${t('month')} (oldest)` },
    { value: 'amount-desc', label: `${t('totalAmount')} (high–low)` },
    { value: 'amount-asc', label: `${t('totalAmount')} (low–high)` },
  ];

  if (!canAccess) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <p className="text-slate-700">{t('accessDenied')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={t('workRecords')}>
          <Skeleton className="h-10 w-32" variant="rect" />
        </PageHeader>
        <PageLoader mode="table" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('workRecords')}>
        {canAdd && (
          <button
            onClick={openCreate}
            disabled={!Array.isArray(employees) || employees.length === 0}
            className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title={employees.length === 0 ? t('noContractors') : ''}
          >
            {t('add')} {t('workRecord')}
          </button>
        )}
      </PageHeader>

      <ListToolbar search={search} onSearchChange={setSearch} sortBy={sortBy} onSortChange={setSortBy} sortOptions={SORT_OPTIONS} viewMode={viewMode} onViewModeChange={setViewMode} searchPlaceholder={t('search')}>
        <div className="flex flex-wrap gap-3 items-end">
          {!isEmployee && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('employeeName')}</label>
              <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white">
                <option value="">{t('all')}</option>
                {(Array.isArray(employees) ? employees : []).map((e) => (
                  <option key={e._id} value={e._id}>{e.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('branches')}</label>
            <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white">
              <option value="">{t('all')}</option>
              {(Array.isArray(branches) ? branches : []).map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>
          {!isEmployee && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('filterByDepartment')}</label>
              <select value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white">
                <option value="">{t('all')}</option>
                {(Array.isArray(departments) ? departments : []).map((d: { _id: string; name: string }) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('month')}</label>
            <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white" />
          </div>
        </div>
      </ListToolbar>

      {viewMode === 'table' ? (
        <>
          <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-uff-surface">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('employeeName')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('branches')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('month')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('styleOrder')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('totalAmount')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-600">{t('noData')}</td>
                    </tr>
                  ) : (
                    sorted.map((r) => (
                      <tr key={r._id} className="hover:bg-uff-surface">
                        <td className="px-4 py-3 text-slate-800">{(r.employee as { name?: string })?.name}</td>
                        <td className="px-4 py-3 text-slate-700">{(r.branch as { name?: string })?.name}</td>
                        <td className="px-4 py-3 text-slate-700 text-sm">{formatMonth((r as { month?: string }).month)}</td>
                        <td className="px-4 py-3 text-slate-700">
                          {(() => {
                            const so = r.styleOrder as { styleCode?: string; brand?: string } | undefined;
                            return so ? (so.brand ? `${so.styleCode || ''} - ${so.brand}` : so.styleCode || '') || '–' : '–';
                          })()}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">₹{formatAmount(r.totalAmount)}</td>
                        <td className="px-4 py-3">
                          <ActionButtons
                            onView={() => openView(r)}
                            onEdit={canAdd ? () => openEdit(r) : undefined}
                            onDelete={canAdd ? () => handleDelete(r._id) : undefined}
                            viewLabel={t('view')}
                            editLabel={t('edit')}
                            deleteLabel={t('delete')}
                          />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {sorted.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
              {hasMore && (
                <button onClick={() => setPage((p) => p + 1)} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium">
                  {t('loadMore')}
                </button>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.length === 0 ? (
            <div className="col-span-full rounded-xl bg-white p-12 text-center text-slate-600 border border-slate-200">{t('noData')}</div>
          ) : (
            sorted.map((r) => (
              <div key={r._id} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                <h3 className="font-semibold text-slate-900">{(r.employee as { name?: string })?.name}</h3>
                <p className="text-sm text-slate-600">{(r.branch as { name?: string })?.name}</p>
                <p className="text-sm text-slate-600">{formatMonth((r as { month?: string }).month)} • {(() => {
                  const so = r.styleOrder as { styleCode?: string; brand?: string } | undefined;
                  return so ? (so.brand ? `${so.styleCode || ''} - ${so.brand}` : so.styleCode || '') || '–' : '–';
                })()}</p>
                <p className="mt-2 font-semibold text-slate-900">₹{formatAmount(r.totalAmount)}</p>
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <ActionButtons
                    onView={() => openView(r)}
                    onEdit={canAdd ? () => openEdit(r) : undefined}
                    onDelete={canAdd ? () => handleDelete(r._id) : undefined}
                    viewLabel={t('view')}
                    editLabel={t('edit')}
                    deleteLabel={t('delete')}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {sorted.length > 0 && viewMode !== 'table' && (
        <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
          <span>Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}</span>
          {hasMore && (
            <button onClick={() => setPage((p) => p + 1)} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-medium">
              {t('loadMore')}
            </button>
          )}
        </div>
      )}

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={`${modal === 'view' ? t('view') : modal === 'create' ? t('add') : t('edit')} ${t('workRecord')}`}
        size="3xl"
        footer={
          <div className="flex gap-3 justify-end">
            {modal !== 'view' && (
              <button
                onClick={handleSave}
                disabled={saving || !form.employeeId || !form.branchId || !form.month || !form.styleOrderId || Object.entries(form.workItems).filter(([, wi]) => (wi.quantity || 0) >= 1).length === 0}
                className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition"
              >
                {saving ? '...' : t('save')}
              </button>
            )}
            {modal === 'view' && editingId && canAdd && (
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
                        const b = (Array.isArray(branches) ? branches : []).find((x: { _id: string; name: string }) => x._id === e.target.value);
                        setForm((f) => ({ ...f, branchId: e.target.value, branchName: b?.name || '', departmentId: '', departmentName: '', employeeId: '', employeeName: '', styleOrderId: '', styleOrderCode: '', workItems: {} }));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      required
                    >
                      <option value="">Select branch first...</option>
                      {(Array.isArray(branches) ? branches : []).map((b) => (
                        <option key={b._id} value={b._id}>{b.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('department')}</label>
                  {modal === 'view' ? (
                    <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-800">{form.departmentName || '–'}</p>
                  ) : (
                    <select
                      value={form.departmentId}
                      onChange={(e) => {
                        const d = (Array.isArray(departments) ? departments : []).find((x: { _id: string; name: string }) => x._id === e.target.value);
                        setForm((f) => ({ ...f, departmentId: e.target.value, departmentName: d?.name || '', employeeId: '', employeeName: '' }));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      disabled={!form.branchId}
                    >
                      <option value="">{!form.branchId ? 'Select branch first' : 'Select department...'}</option>
                      {(Array.isArray(departments) ? departments : []).map((d: { _id: string; name: string }) => (
                        <option key={d._id} value={d._id}>{d.name}</option>
                      ))}
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('employeeName')} <span className="text-red-500" aria-hidden="true">*</span></label>
                  {modal === 'view' ? (
                    <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-800">{form.employeeName || '–'}</p>
                  ) : (
                    <select
                      value={form.employeeId}
                      onChange={(e) => {
                        const emp = employeesForBranchAndDepartment.find((x: Employee) => x._id === e.target.value);
                        setForm((f) => ({ ...f, employeeId: e.target.value, employeeName: emp?.name || '' }));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      required
                    >
                      <option value="">{employeesForBranchAndDepartment.length === 0 && form.branchId ? (form.departmentId ? 'No employees in this branch & department' : 'Select department first') : 'Select employee...'}</option>
                      {employeesForBranchAndDepartment.map((e: Employee) => (
                        <option key={e._id} value={e._id}>{e.name}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('month')} <span className="text-red-500" aria-hidden="true">*</span></label>
                  <input
                    type="month"
                    value={form.month}
                    onChange={(e) => setForm((f) => ({ ...f, month: e.target.value, styleOrderId: '', styleOrderCode: '', workItems: {} }))}
                    readOnly={modal === 'view'}
                    className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${modal === 'view' ? 'bg-slate-50 cursor-default' : ''}`}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('styleOrder')} <span className="text-red-500" aria-hidden="true">*</span></label>
                  {modal === 'view' ? (
                    <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-800">{form.styleOrderCode || '–'}</p>
                  ) : (
                    <select
                      value={form.styleOrderId}
                      onChange={(e) => {
                        const s = (Array.isArray(stylesForForm) ? stylesForForm : []).find((x: { _id: string; styleCode?: string; brand?: string }) => x._id === e.target.value);
                        const display = s ? ((s as { brand?: string }).brand ? `${(s as { styleCode?: string }).styleCode || ''} - ${(s as { brand?: string }).brand}` : (s as { styleCode?: string }).styleCode || '') : '';
                        setForm((f) => ({ ...f, styleOrderId: e.target.value, styleOrderCode: display, workItems: [] }));
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      disabled={!form.branchId || !form.month}
                    >
                      <option value="">{!form.branchId || !form.month ? 'Select branch & month first' : stylesForForm?.length === 0 ? 'No styles for this branch/month' : 'Select style/order (required)...'}</option>
                      {(Array.isArray(stylesForForm) ? stylesForForm : []).map((s: { _id: string; styleCode?: string; brand?: string }) => (
                        <option key={s._id} value={s._id}>
                          {(s.brand ? `${s.styleCode || ''} - ${s.brand}` : s.styleCode) || s._id}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-800 mb-2">{t('workItems')} <span className="text-red-500" aria-hidden="true">*</span></label>
                <p className="text-xs text-slate-600 mb-2">{!form.branchId ? 'Select branch first to load rates' : 'Check the rates that apply. Enter quantity and adjust pricing if needed.'}</p>
                {form.branchId && rates && rates.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="grid grid-cols-[auto_1fr_80px_100px_80px_1fr] gap-2 px-3 py-2 bg-uff-surface text-sm font-medium text-slate-800 border-b border-slate-200">
                      <span className="w-8" />
                      <span>{t('rateName') || 'Rate'}</span>
                      <span>{t('quantityShort') || 'Qty'}</span>
                      <span>{t('rate') || 'Rate (₹)'}</span>
                      <span>{t('amount') || 'Amount'}</span>
                      <span>{t('remarks')}</span>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {(modal === 'view' ? (rates as RateMaster[]).filter((r) => form.workItems[r._id]) : (rates as RateMaster[])).map((r) => {
                        const wi = form.workItems[r._id];
                        const isChecked = !!wi;
                        const showRemarks = isChecked && wi.ratePerUnit !== wi.defaultRatePerUnit;
                        const amount = isChecked ? (wi.quantity || 0) * (wi.ratePerUnit || 0) : 0;
                        return (
                          <div key={r._id} className={`grid grid-cols-[auto_1fr_80px_100px_80px_1fr] gap-2 px-3 py-2 items-center border-b border-slate-100 last:border-0 text-sm ${isChecked ? 'bg-uff-surface/50' : ''}`}>
                            {modal === 'view' ? (
                              <>
                                <span className="w-8" />
                                <span className="text-slate-800">{r.name} ({r.unit})</span>
                                <span>{wi.quantity}</span>
                                <span>₹{wi.ratePerUnit}</span>
                                <span>₹{formatAmount(amount)}</span>
                                <span>{wi.remarks || '–'}</span>
                              </>
                            ) : (
                              <>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => toggleRateChecked(r._id, e.target.checked)}
                                  disabled={!form.branchId}
                                  className="w-4 h-4 rounded border-slate-300"
                                />
                                <span className="text-slate-800">{r.name} ({r.unit})</span>
                                {isChecked ? (
                                  <>
                                    <input
                                      type="number"
                                      min={1}
                                      value={wi.quantity || ''}
                                      onChange={(e) => updateWorkItemField(r._id, 'quantity', parseFloat(e.target.value) || 1)}
                                      className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                      placeholder="1"
                                    />
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={wi.ratePerUnit ?? ''}
                                      onChange={(e) => updateWorkItemField(r._id, 'ratePerUnit', parseFloat(e.target.value) ?? 0)}
                                      className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                      placeholder="0"
                                    />
                                    <span className="text-slate-700">₹{formatAmount(amount)}</span>
                                    {showRemarks ? (
                                      <input
                                        type="text"
                                        value={wi.remarks ?? ''}
                                        onChange={(e) => updateWorkItemField(r._id, 'remarks', e.target.value)}
                                        placeholder={t('remarksRequiredWhenRateChanged')}
                                        className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                                        required
                                      />
                                    ) : (
                                      <span className="text-slate-400 text-xs">–</span>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    <span className="text-slate-400">–</span>
                                    <span className="text-slate-400">–</span>
                                    <span className="text-slate-400">–</span>
                                    <span className="text-slate-400">–</span>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {form.branchId && (!rates || rates.length === 0) && (
                  <p className="text-sm text-slate-500 py-4">No rates configured for this branch.</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-4">
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('otHours')}</label>
                  <ValidatedInput
                    type="text"
                    inputMode="decimal"
                    value={form.otHours != null && form.otHours !== 0 ? String(form.otHours) : ''}
                    onChange={(v) => setForm((f) => ({ ...f, otHours: parseFloat(v) || 0 }))}
                    fieldType="number"
                    placeholderHint="0"
                    readOnly={modal === 'view'}
                    className="w-full px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1">{t('otAmount')} (₹)</label>
                  <ValidatedInput
                    type="text"
                    inputMode="decimal"
                    value={form.otAmount != null && form.otAmount !== 0 ? String(form.otAmount) : ''}
                    onChange={(v) => setForm((f) => ({ ...f, otAmount: parseFloat(v) || 0 }))}
                    fieldType="number"
                    placeholderHint="0"
                    readOnly={modal === 'view'}
                    className="w-full px-3 py-2"
                  />
                </div>
              </div>

              <div className="flex justify-end font-semibold text-lg">
                {t('totalAmount')}: ₹{formatAmount(totalAmount)}
                {(form.otAmount ?? 0) > 0 && (
                  <span className="ml-2 text-sm font-normal text-slate-600">
                    (work: ₹{formatAmount(workTotal)} + OT: ₹{formatAmount(form.otAmount)})
                  </span>
                )}
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
