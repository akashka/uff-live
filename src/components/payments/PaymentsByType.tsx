'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import Modal from '@/components/Modal';
import SaveOverlay from '@/components/SaveOverlay';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import { PageLoader, Skeleton } from '@/components/Skeleton';
import { useEmployees, usePayments, useBranches, useDepartments } from '@/lib/hooks/useApi';
import ValidatedInput from '@/components/ValidatedInput';
import { formatMonth, formatAmount } from '@/lib/utils';
import { toast } from '@/lib/toast';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface Employee {
  _id: string;
  name: string;
  employeeType: string;
  pfOpted?: boolean;
  monthlyPfAmount?: number;
  monthlySalary?: number;
  salaryBreakup?: { pf?: number; esi?: number; other?: number };
}

interface WorkRecord {
  _id: string;
  branch: { name: string };
  month: string;
  workItems: { rateName: string; quantity: number; ratePerUnit: number; amount: number }[];
  totalAmount: number;
}

interface Payment {
  _id: string;
  employee: { name: string; employeeType: string };
  paymentType: string;
  month: string;
  baseAmount: number;
  addDeductAmount: number;
  addDeductRemarks: string;
  pfDeducted: number;
  esiDeducted: number;
  advanceDeducted?: number;
  totalPayable: number;
  paymentAmount: number;
  paymentMode: string;
  transactionRef: string;
  remainingAmount: number;
  carriedForward: number;
  carriedForwardRemarks?: string;
  isAdvance: boolean;
  paidAt: string;
}

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

interface PaymentsByTypeProps {
  paymentType: 'contractor' | 'full_time';
  pageTitle: string;
}

export default function PaymentsByType({ paymentType, pageTitle }: PaymentsByTypeProps) {
  const { t } = useApp();
  const { user } = useAuth();
  const isEmployee = !!user?.employeeId;
  const canView = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '') || isEmployee;
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterEmployee, setFilterEmployee] = useState(isEmployee && user?.employeeId ? user.employeeId : '');
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth());
  const [filterType, setFilterType] = useState<'all' | 'salary' | 'advance'>('all');
  const [advanceDeductedFilter, setAdvanceDeductedFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [page, setPage] = useState(1);
  const { payments, total, limit, hasMore, loading, mutate: mutatePayments } = usePayments(
    filterEmployee || undefined,
    canView,
    {
      page,
      limit: 50,
      month: filterMonth,
      paymentType,
      isAdvance: filterType === 'salary' ? false : filterType === 'advance' ? true : undefined,
    }
  );
  const { employees: allEmployees } = useEmployees(false, { limit: 0, branchId: filterBranch || undefined, departmentId: filterDepartment || undefined });
  const employees = (Array.isArray(allEmployees) ? allEmployees : []).filter((e: Employee) => e.employeeType === paymentType);
  const { branches } = useBranches(true);
  const { departments } = useDepartments(true);
  const [form, setForm] = useState({
    branchId: '',
    departmentId: '',
    employeeId: '',
    paymentType: paymentType as 'contractor' | 'full_time',
    month: getCurrentMonth(),
    baseAmount: 0,
    addDeductAmount: 0,
    addDeductRemarks: '',
    pfDeducted: 0,
    esiDeducted: 0,
    advanceDeducted: 0,
    totalPayable: 0,
    paymentAmount: 0,
    paymentMode: 'cash' as string,
    transactionRef: '',
    remainingAmount: 0,
    carriedForward: 0,
    carriedForwardRemarks: '',
    isAdvance: false,
    workRecordIds: [] as string[],
  });
  const [advanceForm, setAdvanceForm] = useState({
    branchId: '',
    departmentId: '',
    employeeId: '',
    month: getCurrentMonth(),
    amount: 0,
    reasons: '',
    paymentMode: 'cash' as string,
    transactionRef: '',
  });
  const { employees: formEmpList } = useEmployees(false, { limit: 0, branchId: form.branchId || undefined, departmentId: form.departmentId || undefined });
  const employeesForForm = (Array.isArray(formEmpList) ? formEmpList : []).filter((e: Employee) => e.employeeType === paymentType);
  const { employees: advanceFormEmpList } = useEmployees(false, { limit: 0, branchId: advanceForm.branchId || undefined, departmentId: advanceForm.departmentId || undefined });
  const employeesForAdvanceForm = (Array.isArray(advanceFormEmpList) ? advanceFormEmpList : []).filter((e: Employee) => e.employeeType === paymentType);
  const [modal, setModal] = useState(false);
  const [advanceModal, setAdvanceModal] = useState(false);
  const [carryModal, setCarryModal] = useState<{ remaining: number; onConfirm: (amount: number, remarks: string) => void } | null>(null);
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [exportModal, setExportModal] = useState(false);
  const [exportMonth, setExportMonth] = useState(getCurrentMonth());
  const [exportIncludeZero, setExportIncludeZero] = useState(true);
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel'>('excel');

  const canAdd = ['admin', 'finance'].includes(user?.role || '');
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
    setPage(1);
  }, [filterBranch, filterDepartment, filterEmployee, filterMonth, filterType]);

  const openAdvanceModal = (emp?: Employee) => {
    const noEmployees = paymentType === 'contractor' ? t('noContractors') : t('noEmployees');
    if (employees.length === 0 && !emp?._id) {
      toast.error(noEmployees);
      return;
    }
    setAdvanceForm({
      branchId: filterBranch,
      departmentId: filterDepartment,
      employeeId: emp?._id || '',
      month: getCurrentMonth(),
      amount: 0,
      reasons: '',
      paymentMode: 'cash',
      transactionRef: '',
    });
    setAdvanceModal(true);
  };

  const handleAdvanceSubmit = async () => {
    if (!advanceForm.employeeId || !advanceForm.amount || advanceForm.amount <= 0) {
      toast.error(t('error'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employeeId: advanceForm.employeeId,
        paymentType,
        month: advanceForm.month,
        baseAmount: 0,
        addDeductAmount: 0,
        addDeductRemarks: advanceForm.reasons,
        pfDeducted: 0,
        esiDeducted: 0,
        advanceDeducted: 0,
        totalPayable: advanceForm.amount,
        paymentAmount: advanceForm.amount,
        paymentMode: advanceForm.paymentMode,
        transactionRef: advanceForm.transactionRef,
        remainingAmount: 0,
        carriedForward: 0,
        carriedForwardRemarks: '',
        isAdvance: true,
        workRecordIds: [],
      };
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('saveSuccess'));
      await mutatePayments();
      setAdvanceModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const openAdd = (emp?: Employee) => {
    const noEmployees = paymentType === 'contractor' ? t('noContractors') : t('noEmployees');
    if (employees.length === 0 && !emp?._id) {
      toast.error(noEmployees);
      return;
    }
    const empId = emp?._id || '';
    setForm({
      branchId: filterBranch,
      departmentId: filterDepartment,
      employeeId: empId,
      paymentType,
      month: getCurrentMonth(),
      baseAmount: 0,
      addDeductAmount: 0,
      addDeductRemarks: '',
      pfDeducted: 0,
      esiDeducted: 0,
      advanceDeducted: 0,
      totalPayable: 0,
      paymentAmount: 0,
      paymentMode: 'cash',
      transactionRef: '',
      remainingAmount: 0,
      carriedForward: 0,
      carriedForwardRemarks: '',
      isAdvance: false,
      workRecordIds: [],
    });
    setModal(true);
    if (empId) {
      const currentMonth = getCurrentMonth();
      if (paymentType === 'full_time') {
        loadCalculation(empId, currentMonth);
      } else {
        fetch(`/api/payments/last-paid?employeeId=${empId}`)
          .then((r) => r.json())
          .then((last) => {
            const month = last.lastMonth || currentMonth;
            setForm((f) => ({ ...f, month }));
            loadCalculation(empId, month);
          });
      }
    }
  };

  const loadCalculation = async (empId: string, month: string) => {
    if (!empId || !month) return;
    const calc = await fetch(`/api/payments/calculate?employeeId=${empId}&month=${month}&type=${paymentType}`).then((r) => r.json());
    if (calc.error) return;
    const base = calc.baseAmount || 0;
    const pf = paymentType === 'contractor' ? (calc.pfToDeduct || 0) : 0;
    const esi = paymentType === 'contractor' ? (calc.esiToDeduct || 0) : 0;
    const total = base - pf - esi;
    setForm((f) => ({
      ...f,
      baseAmount: base,
      pfDeducted: pf,
      esiDeducted: esi,
      totalPayable: total + f.addDeductAmount,
      workRecordIds: paymentType === 'contractor' ? (calc.workRecords || []).map((r: WorkRecord) => r._id) : [],
    }));
  };

  const onEmployeeChange = (empId: string) => {
    setForm((f) => ({ ...f, employeeId: empId }));
    if (empId && form.month) {
      loadCalculation(empId, form.month);
    }
  };

  const onMonthChange = () => {
    if (form.employeeId && form.month) {
      loadCalculation(form.employeeId, form.month);
    }
  };

  useEffect(() => {
    if (modal && employeesForForm.length === 1 && !form.employeeId) {
      onEmployeeChange(employeesForForm[0]._id);
    }
  }, [modal, employeesForForm, form.employeeId]);

  const totalPayable = form.baseAmount + form.addDeductAmount - form.pfDeducted - form.esiDeducted - (form.advanceDeducted ?? 0);
  const remaining = totalPayable - form.paymentAmount;

  const handleSubmit = async () => {
    if (remaining > 0 && !carryModal) {
      setCarryModal({
        remaining,
        onConfirm: (amount, remarks) => {
          setCarryModal(null);
          doSubmit(amount, remarks);
        },
      });
      return;
    }
    doSubmit(0, '');
  };

  const doSubmit = async (carryAmount?: number, carryRemarks?: string) => {
    setSaving(true);
    try {
      const cf = carryAmount ?? form.carriedForward;
      const cfRemarks = carryRemarks ?? form.carriedForwardRemarks;
      const rem = remaining;
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          totalPayable: form.baseAmount + form.addDeductAmount - form.pfDeducted - form.esiDeducted - (form.advanceDeducted ?? 0),
          remainingAmount: rem,
          carriedForward: cf,
          carriedForwardRemarks: cfRemarks,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('saveSuccess'));
      await mutatePayments();
      setModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const formatMode = (m: string) => PAYMENT_MODES.find((p) => p.value === m)?.label || m;

  if (!canView) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <p className="text-slate-600">{t('accessDenied')}</p>
      </div>
    );
  }

  const filtered = (Array.isArray(payments) ? payments : []).filter((p) => {
    const q = search.toLowerCase();
    if (q) {
      const name = (p.employee as { name?: string })?.name || '';
      if (!name.toLowerCase().includes(q)) return false;
    }
    // Filter by advance deducted status (for salary payments only)
    if (advanceDeductedFilter !== 'all' && !p.isAdvance) {
      const deducted = (p.advanceDeducted ?? 0) > 0;
      if (advanceDeductedFilter === 'yes' && !deducted) return false;
      if (advanceDeductedFilter === 'no' && deducted) return false;
    }
    return true;
  });
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'amount-desc') return (b.paymentAmount || 0) - (a.paymentAmount || 0);
    if (sortBy === 'amount-asc') return (a.paymentAmount || 0) - (b.paymentAmount || 0);
    if (sortBy === 'date-asc') return (a.paidAt || '').localeCompare(b.paidAt || '');
    return (b.paidAt || '').localeCompare(a.paidAt || '');
  });
  const SORT_OPTIONS = [
    { value: 'date-desc', label: `${t('period')} (newest)` },
    { value: 'date-asc', label: `${t('period')} (oldest)` },
    { value: 'amount-desc', label: `${t('paymentAmount')} (high–low)` },
    { value: 'amount-asc', label: `${t('paymentAmount')} (low–high)` },
  ];

  const noEmployeesMsg = paymentType === 'contractor' ? t('noContractors') : t('noEmployees');

  if (loading) {
    return (
      <div>
        <PageHeader title={pageTitle}>
          <Skeleton className="h-10 w-24" variant="rect" />
        </PageHeader>
        <PageLoader mode="table" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={pageTitle}>
        <div className="flex gap-2">
          {canAdd && (
            <>
              <button onClick={() => setExportModal(true)} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 font-medium">
                {t('exportBankFormat')}
              </button>
              <button
                onClick={() => openAdvanceModal()}
                disabled={!Array.isArray(employees) || employees.length === 0}
                className="px-4 py-2 rounded-lg border border-uff-accent text-uff-accent hover:bg-uff-accent/10 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('advancePayment')}
              </button>
              <button
                onClick={() => openAdd()}
                disabled={!Array.isArray(employees) || employees.length === 0}
                className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                title={!Array.isArray(employees) || employees.length === 0 ? noEmployeesMsg : ''}
              >
                {t('add')} {t('payment')}
              </button>
            </>
          )}
        </div>
      </PageHeader>

      <ListToolbar search={search} onSearchChange={setSearch} sortBy={sortBy} onSortChange={setSortBy} sortOptions={SORT_OPTIONS} viewMode={viewMode} onViewModeChange={setViewMode} searchPlaceholder={t('search')}>
        <div className="flex flex-wrap gap-3 items-center">
          {!isEmployee && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t('selectBranch')}</label>
                <select value={filterBranch} onChange={(e) => { setFilterBranch(e.target.value); setFilterDepartment(''); setFilterEmployee(''); }} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white">
                  <option value="">{t('all')}</option>
                  {(Array.isArray(branches) ? branches : []).map((b: { _id: string; name: string }) => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t('selectDepartment')}</label>
                <select value={filterDepartment} onChange={(e) => { setFilterDepartment(e.target.value); setFilterEmployee(''); }} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white">
                  <option value="">{t('all')}</option>
                  {(Array.isArray(departments) ? departments : []).map((d: { _id: string; name: string }) => (
                    <option key={d._id} value={d._id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">{t('employeeName')}</label>
                <select value={filterEmployee} onChange={(e) => setFilterEmployee(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white">
                  <option value="">{t('all')}</option>
                  {employees.map((e) => (
                    <option key={e._id} value={e._id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('month')}</label>
            <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('payment')}</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as 'all' | 'salary' | 'advance')} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white">
              <option value="all">{t('all')}</option>
              <option value="salary">{t('salaryPayment')}</option>
              <option value="advance">{t('advancePayment')}</option>
            </select>
          </div>
          {(filterType === 'all' || filterType === 'salary') && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('advanceDeducted')}</label>
              <select value={advanceDeductedFilter} onChange={(e) => setAdvanceDeductedFilter(e.target.value as 'all' | 'yes' | 'no')} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white">
                <option value="all">{t('all')}</option>
                <option value="yes">{t('advanceDeducted')} ✓</option>
                <option value="no">{t('advanceNotDeducted')}</option>
              </select>
            </div>
          )}
        </div>
      </ListToolbar>

      {viewMode === 'table' ? (
        <>
          <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('employeeName')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('month')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('totalAmount')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('paymentAmount')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('paymentMode')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('status')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-600">{t('noData')}</td>
                    </tr>
                  ) : (
                    sorted.map((p) => (
                      <tr key={p._id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-800">{(p.employee as { name?: string })?.name}</td>
                        <td className="px-4 py-3 text-slate-600 text-sm">{formatMonth(p.month)}</td>
                        <td className="px-4 py-3 text-right">₹{formatAmount(p.totalPayable)}</td>
                        <td className="px-4 py-3 text-right font-medium">₹{formatAmount(p.paymentAmount)}</td>
                        <td className="px-4 py-3">
                          {p.isAdvance ? (
                            <span className="text-slate-400 text-sm">—</span>
                          ) : (p.advanceDeducted ?? 0) > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-sm font-medium" title={t('advanceDeducted')}>
                              ✓ ₹{formatAmount(p.advanceDeducted)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-sm" title={t('advanceNotDeducted')}>
                              {t('advanceNotDeducted')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-800">{formatMode(p.paymentMode)}</td>
                        <td className="px-4 py-3">
                          {p.remainingAmount > 0 ? (
                            <span className="text-uff-accent text-sm">₹{formatAmount(p.remainingAmount)} {t('due')}</span>
                          ) : p.isAdvance ? (
                            <span className="text-blue-600 text-sm">{t('advance')}</span>
                          ) : (
                            <span className="text-green-600 text-sm">{t('paid')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setDetailPayment(p)} className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium text-sm hover:bg-slate-100 transition">
                            {t('view')}
                          </button>
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
            sorted.map((p) => (
              <div key={p._id} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                <h3 className="font-semibold text-slate-900">{(p.employee as { name?: string })?.name}</h3>
                <p className="text-sm text-slate-600">{formatMonth(p.month)}</p>
                <p className="mt-2 font-semibold text-slate-900">₹{formatAmount(p.paymentAmount)}</p>
                <p className="text-sm text-slate-600">{formatMode(p.paymentMode)}</p>
                {!p.isAdvance && (
                  <p className="mt-1 text-sm">
                    {(p.advanceDeducted ?? 0) > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-medium">
                        ✓ {t('advanceDeducted')} ₹{formatAmount(p.advanceDeducted)}
                      </span>
                    ) : (
                      <span className="text-slate-500">{t('advanceNotDeducted')}</span>
                    )}
                  </p>
                )}
                {p.remainingAmount > 0 ? (
                  <span className="inline-block mt-2 text-uff-accent text-sm">₹{formatAmount(p.remainingAmount)} {t('due')}</span>
                ) : p.isAdvance ? (
                  <span className="inline-block mt-2 text-blue-600 text-sm">{t('advance')}</span>
                ) : (
                  <span className="inline-block mt-2 text-green-600 text-sm">{t('paid')}</span>
                )}
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <button onClick={() => setDetailPayment(p)} className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium text-sm hover:bg-slate-100 transition">
                    {t('view')}
                  </button>
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

      <Modal open={!!(modal && canAdd)} onClose={() => setModal(false)} title={`${t('add')} ${t('payment')} — ${pageTitle}`} size="2xl" footer={
        <div className="flex gap-3 justify-end">
          <button onClick={() => setModal(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
            {t('cancel')}
          </button>
          <button onClick={handleSubmit} disabled={saving || !form.employeeId || !form.month || !form.paymentAmount} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition">
            {saving ? '...' : t('save')}
          </button>
        </div>
      }>
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('selectBranch')}</label>
              <select value={form.branchId} onChange={(e) => setForm((f) => ({ ...f, branchId: e.target.value, departmentId: '', employeeId: '' }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent">
                <option value="">{t('selectBranch')}...</option>
                {(Array.isArray(branches) ? branches : []).map((b: { _id: string; name: string }) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('selectDepartment')}</label>
              <select value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value, employeeId: '' }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent">
                <option value="">{form.branchId ? `${t('selectDepartment')}...` : t('selectBranch') + ' first'}</option>
                {(Array.isArray(departments) ? departments : []).map((d: { _id: string; name: string }) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('employeeName')} <span className="text-red-500" aria-hidden="true">*</span></label>
              <select value={form.employeeId} onChange={(e) => onEmployeeChange(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent" required>
                <option value="">{employeesForForm.length === 0 && form.branchId ? (form.departmentId ? noEmployeesMsg : t('selectDepartment') + ' first') : 'Select...'}</option>
                {employeesForForm.map((e) => (
                  <option key={e._id} value={e._id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('month')} <span className="text-red-500" aria-hidden="true">*</span></label>
              <input type="month" value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))} onBlur={onMonthChange} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent" />
            </div>
          </div>
          <button type="button" onClick={() => form.employeeId && onMonthChange()} className="text-sm font-medium text-uff-accent hover:text-uff-accent-hover">
            {t('calculate')}
          </button>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-sm text-slate-800">{t('baseAmount')}: ₹{formatAmount(form.baseAmount)}</p>
            {paymentType === 'contractor' && form.pfDeducted > 0 && (
              <p className="text-sm text-slate-800">{t('pf')} {t('deducted')}: -₹{formatAmount(form.pfDeducted)}</p>
            )}
            {paymentType === 'contractor' && form.esiDeducted > 0 && (
              <p className="text-sm text-slate-800">{t('esi')} {t('deducted')}: -₹{formatAmount(form.esiDeducted)}</p>
            )}
            {(form.advanceDeducted ?? 0) > 0 && (
              <p className="text-sm text-slate-800">{t('advance')} {t('deducted')}: -₹{formatAmount(form.advanceDeducted)}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('addDeduct')} (₹)</label>
              <ValidatedInput type="text" inputMode="decimal" value={form.addDeductAmount ? String(form.addDeductAmount) : ''} onChange={(v) => setForm((f) => ({ ...f, addDeductAmount: parseFloat(v) || 0 }))} placeholderHint="+/- amount" validate={(v) => v.trim() === '' || !isNaN(parseFloat(v))} className="w-full px-3 py-2.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('remarks')}</label>
              <ValidatedInput type="text" value={form.addDeductRemarks} onChange={(v) => setForm((f) => ({ ...f, addDeductRemarks: v }))} fieldType="text" placeholderHint="Optional" className="w-full px-3 py-2.5" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('advanceDeducted')} (₹)</label>
              <ValidatedInput type="text" inputMode="decimal" value={form.advanceDeducted != null && form.advanceDeducted !== 0 ? String(form.advanceDeducted) : ''} onChange={(v) => setForm((f) => ({ ...f, advanceDeducted: parseFloat(v) || 0 }))} fieldType="number" placeholderHint="0" className="w-full px-3 py-2.5" />
            </div>
          </div>

          <div className="p-4 bg-uff-accent/5 rounded-xl border border-uff-accent/20">
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('totalPayable')}</label>
            <p className="text-2xl font-bold text-slate-900">₹{formatAmount(totalPayable)}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('paymentAmount')} (₹) <span className="text-red-500" aria-hidden="true">*</span></label>
              <ValidatedInput type="text" inputMode="decimal" value={form.paymentAmount ? String(form.paymentAmount) : ''} onChange={(v) => setForm((f) => ({ ...f, paymentAmount: parseFloat(v) || 0 }))} fieldType="number" placeholderHint="e.g. 5000" className="w-full px-3 py-2.5" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('paymentMode')} <span className="text-red-500" aria-hidden="true">*</span></label>
              <select value={form.paymentMode} onChange={(e) => setForm((f) => ({ ...f, paymentMode: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent">
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('transactionRef')}</label>
            <ValidatedInput type="text" value={form.transactionRef} onChange={(v) => setForm((f) => ({ ...f, transactionRef: v }))} fieldType="text" placeholderHint="Cheque no, ref..." className="w-full px-3 py-2.5" />
          </div>

          {remaining > 0 && <p className="text-uff-accent text-sm font-medium">{t('remainingDue')}: ₹{formatAmount(remaining)}</p>}
        </div>
      </Modal>

      <Modal open={!!(advanceModal && canAdd)} onClose={() => setAdvanceModal(false)} title={t('advancePayment')} size="lg" footer={
        <div className="flex gap-3 justify-end">
          <button onClick={() => setAdvanceModal(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
            {t('cancel')}
          </button>
          <button onClick={handleAdvanceSubmit} disabled={saving || !advanceForm.employeeId || !advanceForm.amount || advanceForm.amount <= 0} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition">
            {saving ? '...' : t('save')}
          </button>
        </div>
      }>
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('selectBranch')} <span className="text-red-500">*</span></label>
              <select value={advanceForm.branchId} onChange={(e) => setAdvanceForm((f) => ({ ...f, branchId: e.target.value, departmentId: '', employeeId: '' }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent">
                <option value="">{t('selectBranch')}...</option>
                {(Array.isArray(branches) ? branches : []).map((b: { _id: string; name: string }) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('selectDepartment')} <span className="text-red-500">*</span></label>
              <select value={advanceForm.departmentId} onChange={(e) => setAdvanceForm((f) => ({ ...f, departmentId: e.target.value, employeeId: '' }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent">
                <option value="">{advanceForm.branchId ? `${t('selectDepartment')}...` : t('selectBranch') + ' first'}</option>
                {(Array.isArray(departments) ? departments : []).map((d: { _id: string; name: string }) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('employeeName')} <span className="text-red-500">*</span></label>
              <select value={advanceForm.employeeId} onChange={(e) => setAdvanceForm((f) => ({ ...f, employeeId: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent" required>
                <option value="">{employeesForAdvanceForm.length === 0 && advanceForm.branchId ? (advanceForm.departmentId ? noEmployeesMsg : t('selectDepartment') + ' first') : 'Select...'}</option>
                {employeesForAdvanceForm.map((e) => (
                  <option key={e._id} value={e._id}>{e.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('month')} <span className="text-red-500">*</span></label>
              <input type="month" value={advanceForm.month} onChange={(e) => setAdvanceForm((f) => ({ ...f, month: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('amount')} (₹) <span className="text-red-500">*</span></label>
            <ValidatedInput type="text" inputMode="decimal" value={advanceForm.amount ? String(advanceForm.amount) : ''} onChange={(v) => setAdvanceForm((f) => ({ ...f, amount: parseFloat(v) || 0 }))} placeholderHint="e.g. 5000" validate={(v) => v.trim() === '' || !isNaN(parseFloat(v))} className="w-full px-3 py-2.5" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('reasons')}</label>
            <ValidatedInput type="text" value={advanceForm.reasons} onChange={(v) => setAdvanceForm((f) => ({ ...f, reasons: v }))} fieldType="text" placeholderHint="Optional" className="w-full px-3 py-2.5" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('paymentMode')} <span className="text-red-500">*</span></label>
              <select value={advanceForm.paymentMode} onChange={(e) => setAdvanceForm((f) => ({ ...f, paymentMode: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent">
                {PAYMENT_MODES.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('transactionRef')}</label>
              <ValidatedInput type="text" value={advanceForm.transactionRef} onChange={(v) => setAdvanceForm((f) => ({ ...f, transactionRef: v }))} fieldType="text" placeholderHint="Cheque no, ref..." className="w-full px-3 py-2.5" />
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={!!detailPayment} onClose={() => setDetailPayment(null)} title={t('paymentDetails')} size="lg" footer={
        <button onClick={() => setDetailPayment(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
          {t('close')}
        </button>
      }>
        {detailPayment && (
          <div className="space-y-3 text-sm">
              <p><span className="font-medium text-slate-700">{t('employeeName')}:</span> {(detailPayment.employee as { name?: string })?.name}</p>
              <p><span className="font-medium text-slate-700">{t('month')}:</span> {formatMonth(detailPayment.month)}</p>
              <p><span className="font-medium text-slate-700">{t('baseAmount')}:</span> ₹{formatAmount(detailPayment.baseAmount)}</p>
              {detailPayment.addDeductAmount !== 0 && <p><span className="font-medium text-slate-700">{t('addDeduct')}:</span> {detailPayment.addDeductAmount > 0 ? '+' : ''}₹{formatAmount(detailPayment.addDeductAmount)} {detailPayment.addDeductRemarks && `(${detailPayment.addDeductRemarks})`}</p>}
              {detailPayment.pfDeducted > 0 && <p><span className="font-medium text-slate-700">{t('pf')}:</span> -₹{formatAmount(detailPayment.pfDeducted)}</p>}
              {detailPayment.esiDeducted > 0 && <p><span className="font-medium text-slate-700">{t('esi')}:</span> -₹{formatAmount(detailPayment.esiDeducted)}</p>}
              {(detailPayment.advanceDeducted ?? 0) > 0 && <p><span className="font-medium text-slate-700">{t('advance')}:</span> -₹{formatAmount(detailPayment.advanceDeducted)}</p>}
              <p><span className="font-medium text-slate-700">{t('totalPayable')}:</span> ₹{formatAmount(detailPayment.totalPayable)}</p>
              <p><span className="font-medium text-slate-700">{t('paymentAmount')}:</span> ₹{formatAmount(detailPayment.paymentAmount)}</p>
              <p><span className="font-medium text-slate-700">{t('paymentMode')}:</span> {formatMode(detailPayment.paymentMode)}</p>
              {detailPayment.transactionRef && <p><span className="font-medium text-slate-700">{t('transactionRef')}:</span> {detailPayment.transactionRef}</p>}
              {detailPayment.remainingAmount > 0 && <p className="text-uff-accent"><span className="font-medium">{t('remainingDue')}:</span> ₹{formatAmount(detailPayment.remainingAmount)}</p>}
              {detailPayment.carriedForward > 0 && <p><span className="font-medium text-slate-700">{t('carryForward')}:</span> ₹{formatAmount(detailPayment.carriedForward)} {detailPayment.carriedForwardRemarks && `(${detailPayment.carriedForwardRemarks})`}</p>}
              {detailPayment.isAdvance && <p className="text-blue-600">{t('advance')}</p>}
          </div>
        )}
      </Modal>

      {carryModal && (
        <Modal open={!!carryModal} onClose={() => setCarryModal(null)} title={t('remainingAmount')} size="md" footer={
          <div className="flex gap-3 justify-end">
            <button onClick={() => setCarryModal(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
              {t('cancel')}
            </button>
            <button onClick={() => carryModal.onConfirm(0, '')} className="px-4 py-2.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-medium transition">
              {t('makeZero')}
            </button>
            <button
              onClick={() => {
                const amt = parseFloat((document.getElementById('carry-amount') as HTMLInputElement)?.value || '0') || 0;
                const remarks = (document.getElementById('carry-remarks') as HTMLInputElement)?.value || '';
                carryModal.onConfirm(amt, remarks);
              }}
              className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium transition"
            >
              {t('carryForward')}
            </button>
          </div>
        }>
          <p className="text-slate-600 mb-4">
            {t('remainingDue')}: ₹{formatAmount(carryModal.remaining)}. {t('carryForwardQuestion')}
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('carryForwardAmount')}</label>
              <input type="number" id="carry-amount" defaultValue={carryModal.remaining} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('remarks')}</label>
              <input type="text" id="carry-remarks" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent" placeholder={t('optionalRemarks')} />
            </div>
          </div>
        </Modal>
      )}

      <Modal open={exportModal} onClose={() => setExportModal(false)} title={t('exportBankFormat')} size="lg" footer={
        <div className="flex gap-3 justify-end">
          <button onClick={() => setExportModal(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
            {t('cancel')}
          </button>
          <button
            onClick={() => {
              const params = new URLSearchParams();
              params.set('format', exportFormat);
              params.set('includeZero', String(exportIncludeZero));
              params.set('paymentType', paymentType);
              if (exportMonth) params.set('month', exportMonth);
              window.open(`/api/payments/export?${params.toString()}`, '_blank');
              setExportModal(false);
            }}
            className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium transition"
          >
            Export
          </button>
        </div>
      }>
        <p className="text-sm text-slate-600 mb-5">Export payments in bank transfer format (Amount, Beneficiary_Name, IFSC, Account_No) for NEFT/IMPS.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('month')}</label>
            <input type="month" value={exportMonth} onChange={(e) => setExportMonth(e.target.value)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('exportFormat')}</label>
            <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value as 'csv' | 'excel')} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent focus:border-uff-accent">
              <option value="excel">Excel (.xlsx)</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={exportIncludeZero} onChange={(e) => setExportIncludeZero(e.target.checked)} className="rounded border-slate-300 text-uff-accent focus:ring-uff-accent" />
            <span className="text-sm font-medium text-slate-800">{t('includeZeroAmounts')}</span>
          </label>
        </div>
      </Modal>

      <SaveOverlay show={saving} label={t('saving')} />
    </div>
  );
}
