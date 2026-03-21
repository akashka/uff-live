'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import Modal from '@/components/Modal';
import SaveOverlay from '@/components/SaveOverlay';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import { PageLoader, Skeleton } from '@/components/Skeleton';
import { useEmployees, usePayments, useVendorPayments, useBranches, useDepartments, useVendors } from '@/lib/hooks/useApi';
import ValidatedInput from '@/components/ValidatedInput';
import { formatMonth, formatAmount, roundAmount, roundDays } from '@/lib/utils';
import { toast } from '@/lib/toast';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

type RecipientType = 'full_time' | 'contractor' | 'vendor';
type PaymentKind = 'advance' | 'job_order';
type FilterEmployeeType = 'all' | 'contractor' | 'full_time' | 'vendor';

interface Employee {
  _id: string;
  name: string;
  employeeType: string;
  pfOpted?: boolean;
  monthlyPfAmount?: number;
  monthlySalary?: number;
  salaryBreakup?: { pf?: number; esi?: number; other?: number };
}

interface WorkItemRow {
  rateName: string;
  quantity: number;
  ratePerUnit: number;
  amount: number;
  unit?: string;
}

interface WorkRecordCalc {
  _id: string;
  branch: { name: string };
  month: string;
  styleOrder?: { styleCode: string; brand?: string } | null;
  workItems: WorkItemRow[];
  totalAmount: number;
}

interface VendorWorkItemRow {
  rateName: string;
  quantity: number;
  ratePerUnit: number;
  amount: number;
  unit?: string;
}

interface VendorWorkOrderCalc {
  _id: string;
  branch: { name: string };
  month: string;
  styleOrder?: { styleCode: string; brand?: string } | null;
  workItems: VendorWorkItemRow[];
  totalAmount: number;
}

interface EmployeePayment {
  _id: string;
  employee: { name: string; employeeType: string };
  paymentType: string;
  month: string;
  baseAmount: number;
  totalPayable: number;
  paymentAmount: number;
  paymentMode: string;
  transactionRef?: string;
  remainingAmount: number;
  advanceDeducted?: number;
  isAdvance: boolean;
  paidAt: string;
  daysWorked?: number;
  totalWorkingDays?: number;
  virtualDaysAttended?: number;
}

interface VendorPaymentItem {
  _id: string;
  vendor: { name: string };
  month: string;
  baseAmount: number;
  totalPayable: number;
  paymentAmount: number;
  paymentMode: string;
  paymentType: 'advance' | 'monthly';
  remainingAmount?: number;
  paidAt: string;
}

interface UnifiedPaymentRow {
  _id: string;
  type: 'contractor' | 'full_time' | 'vendor';
  name: string;
  month: string;
  totalPayable: number;
  paymentAmount: number;
  paymentMode: string;
  remainingAmount: number;
  status: string;
  isAdvance: boolean;
  raw: EmployeePayment | VendorPaymentItem;
}

const PAYMENT_MODES = [
  { value: 'cash', label: 'Cash' },
  { value: 'upi', label: 'UPI' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'other', label: 'Other' },
];

export default function AllPayments() {
  const { t } = useApp();
  const { user } = useAuth();
  const isEmployee = !!user?.employeeId;
  const canView = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '') || isEmployee;
  const canAdd = ['admin', 'finance'].includes(user?.role || '');
  const isAccountancy = user?.role === 'accountancy';

  const [filterEmployeeType, setFilterEmployeeType] = useState<FilterEmployeeType>(
    isEmployee ? (user?.employeeType === 'contractor' ? 'contractor' : 'full_time') : 'all'
  );
  const [filterBranch, setFilterBranch] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterEmployee, setFilterEmployee] = useState(isEmployee && user?.employeeId ? user.employeeId : '');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterMonth, setFilterMonth] = useState(getCurrentMonth());
  const [filterType, setFilterType] = useState<'all' | 'salary' | 'advance'>('all');
  const [advanceDeductedFilter, setAdvanceDeductedFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('date-desc');
  const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
  const [saving, setSaving] = useState(false);
  const [detailPayment, setDetailPayment] = useState<UnifiedPaymentRow | null>(null);
  const [detailPaymentFull, setDetailPaymentFull] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const fetchEmployeePayments =
    filterEmployeeType === 'all' || filterEmployeeType === 'contractor' || filterEmployeeType === 'full_time';
  const fetchVendorPayments = filterEmployeeType === 'all' || filterEmployeeType === 'vendor';

  const empPaymentType =
    filterEmployeeType === 'contractor'
      ? ('contractor' as const)
      : filterEmployeeType === 'full_time'
        ? ('full_time' as const)
        : undefined;

  const { payments: empPayments, total: empTotal, limit: empLimit, hasMore: empHasMore, loading: empLoading, mutate: mutateEmpPayments } = usePayments(
    filterEmployee || undefined,
    canView && fetchEmployeePayments,
    {
      page,
      limit: 50,
      month: filterMonth,
      paymentType: empPaymentType,
      isAdvance: filterType === 'salary' ? false : filterType === 'advance' ? true : undefined,
    }
  );

  const { payments: vendorPayments, total: vendorTotal, limit: vendorLimit, hasMore: vendorHasMore, loading: vendorLoading, mutate: mutateVendorPayments } = useVendorPayments(
    filterVendor || undefined,
    canView && fetchVendorPayments,
    {
      page,
      limit: 50,
      month: filterMonth,
      paymentType: filterType === 'salary' ? 'monthly' : filterType === 'advance' ? 'advance' : undefined,
    }
  );

  const { employees: allEmployees } = useEmployees(false, { limit: 0, branchId: filterBranch || undefined, departmentId: filterDepartment || undefined });
  const { branches } = useBranches(true);
  const { departments } = useDepartments(true);
  const { vendors } = useVendors(true, { limit: 0 });

  const employees =
    filterEmployeeType === 'contractor'
      ? (Array.isArray(allEmployees) ? allEmployees : []).filter((e: Employee) => e.employeeType === 'contractor')
      : filterEmployeeType === 'full_time'
        ? (Array.isArray(allEmployees) ? allEmployees : []).filter((e: Employee) => e.employeeType === 'full_time')
        : (Array.isArray(allEmployees) ? allEmployees : []).filter((e: Employee) => e.employeeType === 'contractor' || e.employeeType === 'full_time');

  const [addModal, setAddModal] = useState(false);
  const [modalRecipientType, setModalRecipientType] = useState<RecipientType | ''>('');
  const [modalPaymentKind, setModalPaymentKind] = useState<PaymentKind | ''>('');

  const [empForm, setEmpForm] = useState({
    branchId: '',
    departmentId: '',
    employeeId: '',
    paymentType: 'contractor' as 'contractor' | 'full_time',
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
    daysWorked: 0,
    totalWorkingDays: 0,
    advanceAmount: 0,
    advanceReasons: '',
  });

  const [vendorForm, setVendorForm] = useState({
    vendorId: '',
    paymentType: 'monthly' as 'advance' | 'monthly',
    month: getCurrentMonth(),
    baseAmount: 0,
    addDeductAmount: 0,
    addDeductRemarks: '',
    totalPayable: 0,
    paymentAmount: 0,
    paymentMode: 'cash' as string,
    transactionRef: '',
    remainingAmount: 0,
    carriedForward: 0,
    carriedForwardRemarks: '',
    vendorWorkOrderIds: [] as string[],
    advanceAmount: 0,
    advanceRemarks: '',
  });

  const [carryModal, setCarryModal] = useState<{ remaining: number; onConfirm: (amount: number, remarks: string) => void } | null>(null);
  const [calc, setCalc] = useState<{ baseAmount: number; grossSalary?: number; pf?: number; esi?: number; other?: number; totalWorkingDays?: number; workRecords?: WorkRecordCalc[] } | null>(null);
  const [vendorCalc, setVendorCalc] = useState<{ baseAmount: number; workOrders?: VendorWorkOrderCalc[] } | null>(null);
  const [advanceOutstanding, setAdvanceOutstanding] = useState(0);

  const { employees: formEmpList } = useEmployees(false, { limit: 0, branchId: empForm.branchId || undefined, departmentId: empForm.departmentId || undefined });
  const employeesForForm = (Array.isArray(formEmpList) ? formEmpList : []).filter(
    (e: Employee) => (modalRecipientType === 'contractor' && e.employeeType === 'contractor') || (modalRecipientType === 'full_time' && e.employeeType === 'full_time')
  );

  useEffect(() => {
    if (isEmployee && user?.employeeId) setFilterEmployee(user.employeeId);
  }, [isEmployee, user?.employeeId]);

  useEffect(() => {
    if (!isEmployee && employees.length === 1 && !filterEmployee && (filterEmployeeType === 'contractor' || filterEmployeeType === 'full_time')) {
      setFilterEmployee(employees[0]._id);
    }
  }, [isEmployee, employees, filterEmployee, filterEmployeeType]);

  useEffect(() => {
    setPage(1);
  }, [filterEmployeeType, filterBranch, filterDepartment, filterEmployee, filterVendor, filterMonth, filterType]);

  useEffect(() => {
    if (!detailPayment) {
      setDetailPaymentFull(null);
      return;
    }
    setDetailLoading(true);
    setDetailPaymentFull(null);
    const base = detailPayment.type === 'vendor' ? '/api/vendor-payments' : '/api/payments';
    fetch(`${base}/${detailPayment._id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setDetailPaymentFull(data);
      })
      .finally(() => setDetailLoading(false));
  }, [detailPayment]);

  const mutateAll = () => {
    mutateEmpPayments();
    mutateVendorPayments();
  };

  const unifiedRows: UnifiedPaymentRow[] = [];
  if (fetchEmployeePayments && Array.isArray(empPayments)) {
    for (const p of empPayments as EmployeePayment[]) {
      unifiedRows.push({
        _id: p._id,
        type: p.paymentType === 'full_time' ? 'full_time' : 'contractor',
        name: (p.employee as { name?: string })?.name || '',
        month: p.month,
        totalPayable: p.totalPayable,
        paymentAmount: p.paymentAmount,
        paymentMode: p.paymentMode,
        remainingAmount: p.remainingAmount ?? 0,
        status: p.remainingAmount > 0 ? 'due' : p.isAdvance ? 'advance' : 'paid',
        isAdvance: p.isAdvance,
        raw: p,
      });
    }
  }
  if (fetchVendorPayments && Array.isArray(vendorPayments)) {
    for (const p of vendorPayments as VendorPaymentItem[]) {
      unifiedRows.push({
        _id: (p as { _id: string })._id,
        type: 'vendor',
        name: (p.vendor as { name?: string })?.name || '',
        month: p.month,
        totalPayable: p.totalPayable,
        paymentAmount: p.paymentAmount,
        paymentMode: p.paymentMode,
        remainingAmount: (p as { remainingAmount?: number }).remainingAmount ?? 0,
        status: ((p as { remainingAmount?: number }).remainingAmount ?? 0) > 0 ? 'due' : p.paymentType === 'advance' ? 'advance' : 'paid',
        isAdvance: p.paymentType === 'advance',
        raw: p,
      });
    }
  }

  unifiedRows.sort((a, b) => {
    const paidA = (a.raw as { paidAt?: string }).paidAt || '';
    const paidB = (b.raw as { paidAt?: string }).paidAt || '';
    if (sortBy === 'amount-desc') return b.paymentAmount - a.paymentAmount;
    if (sortBy === 'amount-asc') return a.paymentAmount - b.paymentAmount;
    if (sortBy === 'date-asc') return paidA.localeCompare(paidB);
    return paidB.localeCompare(paidA);
  });

  const filtered = unifiedRows.filter((row) => {
    const q = search.toLowerCase();
    if (q && !row.name.toLowerCase().includes(q)) return false;
    if (advanceDeductedFilter !== 'all' && row.type !== 'vendor' && !row.isAdvance) {
      const empRaw = row.raw as EmployeePayment;
      const deducted = (empRaw.advanceDeducted ?? 0) > 0;
      if (advanceDeductedFilter === 'yes' && !deducted) return false;
      if (advanceDeductedFilter === 'no' && deducted) return false;
    }
    return true;
  });

  const totalRows = filterEmployeeType === 'all' ? empTotal + vendorTotal : filterEmployeeType === 'vendor' ? vendorTotal : empTotal;
  const loading = empLoading || vendorLoading;
  const hasMore = filterEmployeeType === 'all' ? empHasMore || vendorHasMore : filterEmployeeType === 'vendor' ? vendorHasMore : empHasMore;

  const openAdd = () => {
    setModalRecipientType('');
    setModalPaymentKind('');
    setEmpForm({
      branchId: filterBranch,
      departmentId: filterDepartment,
      employeeId: filterEmployee || '',
      paymentType: 'contractor',
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
      daysWorked: 0,
      totalWorkingDays: 0,
      advanceAmount: 0,
      advanceReasons: '',
    });
    setVendorForm({
      vendorId: filterVendor || '',
      paymentType: 'monthly',
      month: getCurrentMonth(),
      baseAmount: 0,
      addDeductAmount: 0,
      addDeductRemarks: '',
      totalPayable: 0,
      paymentAmount: 0,
      paymentMode: 'cash',
      transactionRef: '',
      remainingAmount: 0,
      carriedForward: 0,
      carriedForwardRemarks: '',
      vendorWorkOrderIds: [],
      advanceAmount: 0,
      advanceRemarks: '',
    });
    setCalc(null);
    setVendorCalc(null);
    setAdvanceOutstanding(0);
    setAddModal(true);
  };

  const loadEmpCalculation = async (empId: string, month: string, pType: 'contractor' | 'full_time') => {
    if (!empId || !month) return;
    if (pType === 'full_time') {
      const [calcRes, advRes] = await Promise.all([
        fetch(`/api/payments/calculate?employeeId=${empId}&month=${month}&type=full_time`).then((r) => r.json()),
        fetch(`/api/payments/advance-outstanding?employeeId=${empId}`).then((r) => r.json()),
      ]);
      const outstanding = advRes.error ? 0 : (advRes.outstanding ?? 0);
      setAdvanceOutstanding(outstanding);
      if (!calcRes.error) {
        setCalc(calcRes);
        const twd = calcRes.totalWorkingDays ?? 0;
        setEmpForm((f) => ({
          ...f,
          daysWorked: twd > 0 ? twd : 0,
          advanceDeducted: outstanding,
          baseAmount: calcRes.baseAmount ?? 0,
          pfDeducted: 0,
          esiDeducted: 0,
          workRecordIds: [],
        }));
      }
    } else {
      const calcRes = await fetch(`/api/payments/calculate?employeeId=${empId}&month=${month}&type=contractor`).then((r) => r.json());
      if (!calcRes.error) {
        setCalc(calcRes);
        const base = calcRes.baseAmount ?? 0;
        const pf = calcRes.pfToDeduct ?? 0;
        const esi = calcRes.esiToDeduct ?? 0;
        setEmpForm((f) => ({
          ...f,
          baseAmount: base,
          pfDeducted: pf,
          esiDeducted: esi,
          totalPayable: base - pf - esi + f.addDeductAmount - (f.advanceDeducted ?? 0),
          workRecordIds: (calcRes.workRecords || []).map((r: WorkRecordCalc) => r._id),
        }));
      }
    }
  };

  const loadVendorCalculation = async (vendorId: string, month: string) => {
    if (!vendorId || !month) {
      setVendorCalc(null);
      return;
    }
    const calcRes = await fetch(`/api/vendor-payments/calculate?vendorId=${vendorId}&month=${month}`).then((r) => r.json());
    if (calcRes.error) {
      setVendorCalc(null);
    } else {
      const base = calcRes.baseAmount ?? 0;
      setVendorCalc({ baseAmount: base, workOrders: calcRes.workOrders || [] });
      setVendorForm((f) => ({
        ...f,
        baseAmount: base,
        totalPayable: base + f.addDeductAmount,
        vendorWorkOrderIds: (calcRes.workOrders || []).map((r: { _id: string }) => r._id),
      }));
    }
  };

  const handleEmpAdvanceSubmit = async () => {
    const amount = empForm.advanceAmount || (modalPaymentKind === 'advance' ? empForm.paymentAmount : 0);
    if (!empForm.employeeId || !amount || amount <= 0) {
      toast.error(t('error'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employeeId: empForm.employeeId,
        paymentType: empForm.paymentType,
        month: empForm.month,
        baseAmount: 0,
        addDeductAmount: 0,
        addDeductRemarks: empForm.advanceReasons,
        pfDeducted: 0,
        esiDeducted: 0,
        advanceDeducted: 0,
        totalPayable: amount,
        paymentAmount: amount,
        paymentMode: empForm.paymentMode,
        transactionRef: empForm.transactionRef,
        remainingAmount: 0,
        carriedForward: 0,
        carriedForwardRemarks: '',
        isAdvance: true,
        workRecordIds: [],
      };
      const res = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('saveSuccess'));
      mutateAll();
      setAddModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const totalPayableEmp =
    modalRecipientType === 'full_time'
      ? roundAmount(
          (calc?.totalWorkingDays ?? 0) > 0
            ? (calc?.baseAmount ?? 0) / (calc?.totalWorkingDays ?? 1) * Math.min(empForm.daysWorked, calc?.totalWorkingDays ?? 999) + empForm.addDeductAmount - (empForm.advanceDeducted ?? 0)
            : 0
        )
      : empForm.baseAmount + empForm.addDeductAmount - empForm.pfDeducted - empForm.esiDeducted - (empForm.advanceDeducted ?? 0);
  const remainingEmp = totalPayableEmp - empForm.paymentAmount;

  const handleEmpJobOrderSubmit = async () => {
    if (remainingEmp > 0 && !carryModal) {
      setCarryModal({ remaining: remainingEmp, onConfirm: (amount, remarks) => { setCarryModal(null); doEmpSubmit(amount, remarks); } });
      return;
    }
    doEmpSubmit(0, '');
  };

  const doEmpSubmit = async (carryAmount?: number, carryRemarks?: string) => {
    setSaving(true);
    try {
      const twd = roundDays(calc?.totalWorkingDays ?? 0);
      const dw = roundDays(Math.min(Math.max(0, empForm.daysWorked), twd || 999));
      const prorated = modalRecipientType === 'full_time' && twd > 0 ? roundAmount(((calc?.baseAmount ?? 0) / twd) * dw) : empForm.baseAmount;
      const total = roundAmount(prorated + empForm.addDeductAmount - empForm.pfDeducted - empForm.esiDeducted - (empForm.advanceDeducted ?? 0));
      const payload: Record<string, unknown> = {
        employeeId: empForm.employeeId,
        paymentType: empForm.paymentType,
        month: empForm.month,
        baseAmount: prorated,
        addDeductAmount: empForm.addDeductAmount,
        addDeductRemarks: empForm.addDeductRemarks,
        pfDeducted: empForm.pfDeducted,
        esiDeducted: empForm.esiDeducted,
        advanceDeducted: empForm.advanceDeducted ?? 0,
        totalPayable: total,
        paymentAmount: empForm.paymentAmount,
        paymentMode: empForm.paymentMode,
        transactionRef: empForm.transactionRef,
        remainingAmount: remainingEmp,
        carriedForward: carryAmount ?? 0,
        carriedForwardRemarks: carryRemarks ?? '',
        isAdvance: false,
        workRecordIds: empForm.paymentType === 'contractor' ? empForm.workRecordIds : [],
      };
      if (empForm.paymentType === 'full_time') {
        (payload as Record<string, unknown>).daysWorked = dw;
        (payload as Record<string, unknown>).totalWorkingDays = twd;
      }
      const res = await fetch('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('saveSuccess'));
      mutateAll();
      setAddModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const handleVendorAdvanceSubmit = async () => {
    const amount = vendorForm.advanceAmount || (modalPaymentKind === 'advance' ? vendorForm.paymentAmount : 0);
    if (!vendorForm.vendorId || !amount || amount <= 0) {
      toast.error(t('error'));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/vendor-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: vendorForm.vendorId,
          paymentType: 'advance',
          month: vendorForm.month,
          baseAmount: 0,
          addDeductAmount: 0,
          addDeductRemarks: vendorForm.advanceRemarks,
          totalPayable: amount,
          paymentAmount: amount,
          paymentMode: vendorForm.paymentMode,
          transactionRef: vendorForm.transactionRef,
          remainingAmount: 0,
          carriedForward: 0,
          carriedForwardRemarks: '',
          vendorWorkOrderIds: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('saveSuccess'));
      mutateAll();
      setAddModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const vendorTotalPayable = vendorForm.baseAmount + vendorForm.addDeductAmount;
  const vendorRemaining = vendorTotalPayable - vendorForm.paymentAmount;

  const handleVendorJobOrderSubmit = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/vendor-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...vendorForm,
          paymentType: 'monthly',
          totalPayable: vendorTotalPayable,
          remainingAmount: vendorRemaining,
          carriedForward: vendorRemaining > 0 ? vendorRemaining : 0,
          carriedForwardRemarks: vendorRemaining > 0 ? 'Carried forward' : '',
          vendorWorkOrderIds: vendorForm.vendorWorkOrderIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('saveSuccess'));
      mutateAll();
      setAddModal(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const formatMode = (m: string) => PAYMENT_MODES.find((p) => p.value === m)?.label || m;

  const getTypeLabel = (type: string) => {
    if (type === 'contractor') return t('contractors');
    if (type === 'full_time') return t('fullTime');
    return t('vendors');
  };

  const SORT_OPTIONS = [
    { value: 'date-desc', label: `${t('period')} (newest)` },
    { value: 'date-asc', label: `${t('period')} (oldest)` },
    { value: 'amount-desc', label: `${t('paymentAmount')} (high–low)` },
    { value: 'amount-asc', label: `${t('paymentAmount')} (low–high)` },
  ];

  const canShowEmployeeForm = modalRecipientType === 'contractor' || modalRecipientType === 'full_time';
  const canShowVendorForm = modalRecipientType === 'vendor';
  const isAdvanceFlow = modalPaymentKind === 'advance';
  const isJobOrderFlow = modalPaymentKind === 'job_order';

  const getDisplayDays = (row: UnifiedPaymentRow) => {
    if (row.type !== 'full_time' || row.isAdvance) return null;
    const raw = row.raw as EmployeePayment;
    if (isAccountancy && raw.virtualDaysAttended != null) {
      return { days: roundDays(raw.virtualDaysAttended), total: raw.totalWorkingDays != null ? roundDays(raw.totalWorkingDays) : undefined };
    }
    if (raw.daysWorked != null)
      return { days: roundDays(raw.daysWorked), total: raw.totalWorkingDays != null ? roundDays(raw.totalWorkingDays) : undefined };
    return null;
  };

  if (!canView) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <p className="text-slate-600">{t('accessDenied')}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div>
        <PageHeader title={t('payments')}>
          <Skeleton className="h-10 w-24" variant="rect" />
        </PageHeader>
        <PageLoader mode="table" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('payments')}>
        <div className="flex gap-2">
          {canAdd && (
            <button
              onClick={openAdd}
              disabled={
                (filterEmployeeType === 'contractor' || filterEmployeeType === 'full_time') && (!Array.isArray(employees) || employees.length === 0)
                  ? true
                  : filterEmployeeType === 'vendor' && (!Array.isArray(vendors) || vendors.length === 0)
                    ? true
                    : filterEmployeeType === 'all' &&
                        (!Array.isArray(employees) || employees.length === 0) &&
                        (!Array.isArray(vendors) || vendors.length === 0)
                      ? true
                      : false
              }
              className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('add')}
            </button>
          )}
        </div>
      </PageHeader>

      <ListToolbar search={search} onSearchChange={setSearch} sortBy={sortBy} onSortChange={setSortBy} sortOptions={SORT_OPTIONS} viewMode={viewMode} onViewModeChange={setViewMode} searchPlaceholder={t('search')}>
        <div className="flex flex-wrap gap-3 items-center">
          {!isEmployee && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('employeeType')}</label>
              <select
                value={filterEmployeeType}
                onChange={(e) => {
                  setFilterEmployeeType(e.target.value as FilterEmployeeType);
                  setFilterEmployee('');
                  setFilterVendor('');
                }}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white"
              >
                <option value="all">{t('all')}</option>
                <option value="contractor">{t('contractors')}</option>
                <option value="full_time">{t('fullTime')}</option>
                <option value="vendor">{t('vendors')}</option>
              </select>
            </div>
          )}
          {!isEmployee && (filterEmployeeType === 'contractor' || filterEmployeeType === 'full_time' || filterEmployeeType === 'all') && (
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
                  {employees.map((e: Employee) => (
                    <option key={e._id} value={e._id}>{e.name}</option>
                  ))}
                </select>
              </div>
            </>
          )}
          {!isEmployee && (filterEmployeeType === 'vendor' || filterEmployeeType === 'all') && (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">{t('vendor')}</label>
              <select value={filterVendor} onChange={(e) => setFilterVendor(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white">
                <option value="">{t('all')}</option>
                {(Array.isArray(vendors) ? vendors : []).map((v: { _id: string; name: string }) => (
                  <option key={v._id} value={v._id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('month')}</label>
            <input type="month" value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">{t('payment')}</label>
            <select value={filterType} onChange={(e) => setFilterType(e.target.value as 'all' | 'salary' | 'advance')} className="px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 bg-white">
              <option value="all">{t('all')}</option>
              <option value="salary">{t('paymentAgainstJobOrder')}</option>
              <option value="advance">{t('advancePayment')}</option>
            </select>
          </div>
          {(filterType === 'all' || filterType === 'salary') && (filterEmployeeType === 'contractor' || filterEmployeeType === 'full_time' || filterEmployeeType === 'all') && (
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
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('type')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{filterEmployeeType === 'all' ? t('employeeName') : filterEmployeeType === 'vendor' ? t('vendor') : t('employeeName')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('month')}</th>
                    {(filterEmployeeType === 'full_time' || filterEmployeeType === 'all') && (
                      <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('daysWorked')}</th>
                    )}
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('totalAmount')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('paymentAmount')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('paymentMode')}</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('status')}</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-600">{t('noData')}</td>
                    </tr>
                  ) : (
                    filtered.map((row) => (
                      <tr key={row._id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-sm font-medium bg-slate-100 text-slate-800">{getTypeLabel(row.type)}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-800">{row.name}</td>
                        <td className="px-4 py-3 text-slate-600 text-sm">{formatMonth(row.month)}</td>
                        {(filterEmployeeType === 'full_time' || filterEmployeeType === 'all') && (
                          <td className="px-4 py-3 text-slate-700">
                            {(() => {
                              const d = getDisplayDays(row);
                              if (d) return <span className="font-medium">{d.days}{d.total != null ? ` / ${d.total}` : ''}</span>;
                              return <span className="text-slate-400">—</span>;
                            })()}
                          </td>
                        )}
                        <td className="px-4 py-3 text-right">₹{formatAmount(row.totalPayable)}</td>
                        <td className="px-4 py-3 text-right font-medium">₹{formatAmount(row.paymentAmount)}</td>
                        <td className="px-4 py-3 text-slate-800">{formatMode(row.paymentMode)}</td>
                        <td className="px-4 py-3">
                          {row.status === 'due' ? (
                            <span className="text-uff-accent text-sm">₹{formatAmount(row.remainingAmount)} {t('due')}</span>
                          ) : row.status === 'advance' ? (
                            <span className="text-blue-600 text-sm">{t('advance')}</span>
                          ) : (
                            <span className="text-green-600 text-sm">{t('paid')}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => setDetailPayment(row)} className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium text-sm hover:bg-slate-100 transition">
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
          {filtered.length > 0 && (
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>Showing 1–{filtered.length} of {totalRows}</span>
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
          {filtered.length === 0 ? (
            <div className="col-span-full rounded-xl bg-white p-12 text-center text-slate-600 border border-slate-200">{t('noData')}</div>
          ) : (
            filtered.map((row) => (
              <div key={row._id} className="rounded-xl bg-white border border-slate-200 p-4 shadow-sm hover:shadow-md transition">
                <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800">{getTypeLabel(row.type)}</span>
                <h3 className="font-semibold text-slate-900 mt-1">{row.name}</h3>
                <p className="text-sm text-slate-600">{formatMonth(row.month)}</p>
                <p className="mt-2 font-semibold text-slate-900">₹{formatAmount(row.paymentAmount)}</p>
                <p className="text-sm text-slate-600">{formatMode(row.paymentMode)}</p>
                {row.status === 'due' ? (
                  <span className="inline-block mt-2 text-uff-accent text-sm">₹{formatAmount(row.remainingAmount)} {t('due')}</span>
                ) : row.status === 'advance' ? (
                  <span className="inline-block mt-2 text-blue-600 text-sm">{t('advance')}</span>
                ) : (
                  <span className="inline-block mt-2 text-green-600 text-sm">{t('paid')}</span>
                )}
                <div className="mt-4 pt-4 border-t border-slate-100 flex justify-end">
                  <button onClick={() => setDetailPayment(row)} className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium text-sm hover:bg-slate-100 transition">
                    {t('view')}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add Payment Modal */}
      <Modal
        open={!!(addModal && canAdd)}
        onClose={() => setAddModal(false)}
        title={`${t('add')} ${t('payment')}`}
        size="2xl"
        footer={
          <div className="flex gap-3 justify-end">
            <button onClick={() => setAddModal(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
              {t('cancel')}
            </button>
            {modalRecipientType && modalPaymentKind && (
              <>
                {canShowEmployeeForm && isAdvanceFlow && (
                  <button
                    onClick={handleEmpAdvanceSubmit}
                    disabled={saving || !empForm.employeeId || !(empForm.advanceAmount || empForm.paymentAmount) || (empForm.advanceAmount || empForm.paymentAmount) <= 0}
                    className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition"
                  >
                    {saving ? '...' : t('save')}
                  </button>
                )}
                {canShowEmployeeForm && isJobOrderFlow && (
                  <button
                    onClick={handleEmpJobOrderSubmit}
                    disabled={saving || !empForm.employeeId || !empForm.month || !empForm.paymentAmount}
                    className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition"
                  >
                    {saving ? '...' : t('save')}
                  </button>
                )}
                {canShowVendorForm && isAdvanceFlow && (
                  <button
                    onClick={handleVendorAdvanceSubmit}
                    disabled={saving || !vendorForm.vendorId || !(vendorForm.advanceAmount || vendorForm.paymentAmount) || (vendorForm.advanceAmount || vendorForm.paymentAmount) <= 0}
                    className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition"
                  >
                    {saving ? '...' : t('save')}
                  </button>
                )}
                {canShowVendorForm && isJobOrderFlow && (
                  <button
                    onClick={handleVendorJobOrderSubmit}
                    disabled={saving || !vendorForm.vendorId || !vendorForm.month || !vendorForm.paymentAmount}
                    className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition"
                  >
                    {saving ? '...' : t('save')}
                  </button>
                )}
              </>
            )}
          </div>
        }
      >
        <div className="space-y-6">
          {/* Step 1: Select recipient type */}
          {!modalRecipientType ? (
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-3">{t('selectRecipientType')}</label>
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setModalRecipientType('full_time');
                    setEmpForm((f) => ({ ...f, paymentType: 'full_time' }));
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 font-medium"
                >
                  {t('fullTime')}
                </button>
                <button
                  onClick={() => {
                    setModalRecipientType('contractor');
                    setEmpForm((f) => ({ ...f, paymentType: 'contractor' }));
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 font-medium"
                >
                  {t('contractors')}
                </button>
                <button onClick={() => setModalRecipientType('vendor')} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 font-medium">
                  {t('jobworkVendors')}
                </button>
              </div>
            </div>
          ) : !modalPaymentKind ? (
            /* Step 2: Select payment type (advance vs job order) */
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-3">{t('payment')} {t('type')}</label>
              <div className="flex gap-4">
                <button onClick={() => setModalPaymentKind('advance')} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 font-medium">
                  {t('advancePayment')}
                </button>
                <button onClick={() => setModalPaymentKind('job_order')} className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 font-medium">
                  {t('paymentAgainstJobOrder')}
                </button>
              </div>
            </div>
          ) : (
            /* Step 3: Form content based on selection */
            <>
              {canShowEmployeeForm && (
                <>
                  <div className="flex gap-2 text-sm">
                    <button onClick={() => setModalRecipientType('')} className="text-uff-accent hover:underline">
                      ← {t('selectRecipientType')}
                    </button>
                    <span className="text-slate-400">|</span>
                    <button onClick={() => setModalPaymentKind('')} className="text-uff-accent hover:underline">
                      ← {t('payment')}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('selectBranch')}</label>
                      <select value={empForm.branchId} onChange={(e) => setEmpForm((f) => ({ ...f, branchId: e.target.value, departmentId: '', employeeId: '' }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
                        <option value="">{t('selectBranch')}...</option>
                        {(Array.isArray(branches) ? branches : []).map((b: { _id: string; name: string }) => (
                          <option key={b._id} value={b._id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('selectDepartment')}</label>
                      <select value={empForm.departmentId} onChange={(e) => setEmpForm((f) => ({ ...f, departmentId: e.target.value, employeeId: '' }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
                        <option value="">{empForm.branchId ? `${t('selectDepartment')}...` : t('selectBranch') + ' first'}</option>
                        {(Array.isArray(departments) ? departments : []).map((d: { _id: string; name: string }) => (
                          <option key={d._id} value={d._id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('employeeName')} *</label>
                      <select
                        value={empForm.employeeId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setEmpForm((f) => ({ ...f, employeeId: id, paymentType: modalRecipientType as 'contractor' | 'full_time' }));
                          if (id && empForm.month) loadEmpCalculation(id, empForm.month, modalRecipientType as 'contractor' | 'full_time');
                        }}
                        className="w-full px-3 py-2.5 border border-slate-300 rounded-lg"
                      >
                        <option value="">Select...</option>
                        {employeesForForm.map((e: Employee) => (
                          <option key={e._id} value={e._id}>{e.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('month')} *</label>
                      <input type="month" value={empForm.month} onChange={(e) => setEmpForm((f) => ({ ...f, month: e.target.value }))} onBlur={() => empForm.employeeId && loadEmpCalculation(empForm.employeeId, empForm.month, modalRecipientType as 'contractor' | 'full_time')} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg" />
                    </div>
                  </div>
                  {isAdvanceFlow ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('amount')} (₹) *</label>
                        <ValidatedInput type="text" inputMode="decimal" value={empForm.advanceAmount ? String(empForm.advanceAmount) : ''} onChange={(v) => setEmpForm((f) => ({ ...f, advanceAmount: parseFloat(v) || 0 }))} placeholderHint="e.g. 5000" validate={(v) => v.trim() === '' || !isNaN(parseFloat(v))} className="w-full px-3 py-2.5" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('reasons')}</label>
                        <ValidatedInput type="text" value={empForm.advanceReasons} onChange={(v) => setEmpForm((f) => ({ ...f, advanceReasons: v }))} fieldType="text" placeholderHint="Optional" className="w-full px-3 py-2.5" />
                      </div>
                    </>
                  ) : (
                    <>
                      {modalRecipientType === 'full_time' && calc && (
                        <div className="p-4 bg-slate-50 rounded-xl">
                          <p className="text-sm">{t('baseAmount')}: ₹{formatAmount(calc.baseAmount ?? 0)}</p>
                          <p className="text-sm">{t('daysWorked')}: <ValidatedInput type="number" value={empForm.daysWorked ? String(empForm.daysWorked) : ''} onChange={(v) => setEmpForm((f) => ({ ...f, daysWorked: Math.min(Math.max(0, parseInt(v, 10) || 0), calc?.totalWorkingDays ?? 999) }))} className="w-20 px-2 py-1" /> / {calc.totalWorkingDays ?? 0}</p>
                        </div>
                      )}
                      {modalRecipientType === 'contractor' && calc?.workRecords && calc.workRecords.length > 0 && (
                        <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                          <p className="text-sm font-medium text-slate-800">{t('calculationBreakup')}</p>
                          {calc.workRecords.map((wr: WorkRecordCalc) => {
                            const styleLabel = wr.styleOrder ? ` (${t('styleOrder')}: ${wr.styleOrder.styleCode}${wr.styleOrder.brand ? ` - ${wr.styleOrder.brand}` : ''})` : '';
                            return (
                              <div key={wr._id} className="border-l-2 border-slate-300 pl-3 text-sm">
                                <p className="font-medium text-slate-700">{wr.branch?.name || t('workRecord')}{styleLabel}</p>
                                {(wr.workItems || []).map((item: WorkItemRow, i: number) => (
                                  <p key={i} className="text-slate-600 ml-2">
                                    {item.rateName}: {item.quantity} × ₹{formatAmount(item.ratePerUnit)} = ₹{formatAmount(item.amount)}
                                  </p>
                                ))}
                                <p className="text-slate-800 font-medium mt-1">₹{formatAmount(wr.totalAmount || 0)}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('addDeduct')} (₹)</label>
                          <ValidatedInput type="text" inputMode="decimal" value={empForm.addDeductAmount ? String(empForm.addDeductAmount) : ''} onChange={(v) => setEmpForm((f) => ({ ...f, addDeductAmount: parseFloat(v) || 0 }))} validate={(v) => v.trim() === '' || !isNaN(parseFloat(v))} className="w-full px-3 py-2.5" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('advanceDeducted')} (₹)</label>
                          <ValidatedInput type="text" inputMode="decimal" value={empForm.advanceDeducted ? String(empForm.advanceDeducted) : ''} onChange={(v) => setEmpForm((f) => ({ ...f, advanceDeducted: parseFloat(v) || 0 }))} className="w-full px-3 py-2.5" />
                        </div>
                      </div>
                      <div className="p-4 bg-uff-accent/5 rounded-xl">
                        <p className="text-lg font-bold">₹{formatAmount(totalPayableEmp)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('paymentAmount')} (₹) *</label>
                        <ValidatedInput type="text" inputMode="decimal" value={empForm.paymentAmount ? String(empForm.paymentAmount) : ''} onChange={(v) => setEmpForm((f) => ({ ...f, paymentAmount: parseFloat(v) || 0 }))} className="w-full px-3 py-2.5" />
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('paymentMode')} *</label>
                      <select value={empForm.paymentMode} onChange={(e) => setEmpForm((f) => ({ ...f, paymentMode: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
                        {PAYMENT_MODES.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('transactionRef')}</label>
                      <ValidatedInput type="text" value={empForm.transactionRef} onChange={(v) => setEmpForm((f) => ({ ...f, transactionRef: v }))} fieldType="text" className="w-full px-3 py-2.5" />
                    </div>
                  </div>
                </>
              )}
              {canShowVendorForm && (
                <>
                  <div className="flex gap-2 text-sm">
                    <button onClick={() => setModalRecipientType('')} className="text-uff-accent hover:underline">
                      ← {t('selectRecipientType')}
                    </button>
                    <span className="text-slate-400">|</span>
                    <button onClick={() => setModalPaymentKind('')} className="text-uff-accent hover:underline">
                      ← {t('payment')}
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('vendor')} *</label>
                      <select value={vendorForm.vendorId} onChange={(e) => { const id = e.target.value; setVendorForm((f) => ({ ...f, vendorId: id })); if (id && vendorForm.month) loadVendorCalculation(id, vendorForm.month); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
                        <option value="">Select...</option>
                        {(Array.isArray(vendors) ? vendors : []).map((v: { _id: string; name: string }) => (
                          <option key={v._id} value={v._id}>{v.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('month')} *</label>
                      <input type="month" value={vendorForm.month} onChange={(e) => setVendorForm((f) => ({ ...f, month: e.target.value }))} onBlur={() => vendorForm.vendorId && loadVendorCalculation(vendorForm.vendorId, vendorForm.month)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg" />
                    </div>
                  </div>
                  {isAdvanceFlow ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('amount')} (₹) *</label>
                        <ValidatedInput type="text" inputMode="decimal" value={vendorForm.advanceAmount ? String(vendorForm.advanceAmount) : ''} onChange={(v) => setVendorForm((f) => ({ ...f, advanceAmount: parseFloat(v) || 0 }))} placeholderHint="e.g. 5000" validate={(v) => v.trim() === '' || !isNaN(parseFloat(v))} className="w-full px-3 py-2.5" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('reasons')}</label>
                        <ValidatedInput type="text" value={vendorForm.advanceRemarks} onChange={(v) => setVendorForm((f) => ({ ...f, advanceRemarks: v }))} fieldType="text" className="w-full px-3 py-2.5" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-4 bg-slate-50 rounded-xl">
                        <p className="text-sm">{t('baseAmount')}: ₹{formatAmount(vendorForm.baseAmount)}</p>
                      </div>
                      {vendorCalc?.workOrders && vendorCalc.workOrders.length > 0 && (
                        <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                          <p className="text-sm font-medium text-slate-800">{t('calculationBreakup')}</p>
                          {vendorCalc.workOrders.map((wo: VendorWorkOrderCalc) => {
                            const styleLabel = wo.styleOrder ? ` (${t('styleOrder')}: ${wo.styleOrder.styleCode}${wo.styleOrder.brand ? ` - ${wo.styleOrder.brand}` : ''})` : '';
                            return (
                              <div key={wo._id} className="border-l-2 border-slate-300 pl-3 text-sm">
                                <p className="font-medium text-slate-700">{wo.branch?.name || t('vendorWorkOrders')}{styleLabel}</p>
                                {(wo.workItems || []).map((item: VendorWorkItemRow, i: number) => (
                                  <p key={i} className="text-slate-600 ml-2">
                                    {item.rateName}: {item.quantity} × ₹{formatAmount(item.ratePerUnit)} = ₹{formatAmount(item.amount)}
                                  </p>
                                ))}
                                <p className="text-slate-800 font-medium mt-1">₹{formatAmount(wo.totalAmount || 0)}</p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('addDeduct')} (₹)</label>
                        <ValidatedInput type="text" inputMode="decimal" value={vendorForm.addDeductAmount ? String(vendorForm.addDeductAmount) : ''} onChange={(v) => setVendorForm((f) => ({ ...f, addDeductAmount: parseFloat(v) || 0 }))} className="w-full px-3 py-2.5" />
                      </div>
                      <div className="p-4 bg-uff-accent/5 rounded-xl">
                        <p className="text-lg font-bold">₹{formatAmount(vendorTotalPayable)}</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('paymentAmount')} (₹) *</label>
                        <ValidatedInput type="text" inputMode="decimal" value={vendorForm.paymentAmount ? String(vendorForm.paymentAmount) : ''} onChange={(v) => setVendorForm((f) => ({ ...f, paymentAmount: parseFloat(v) || 0 }))} className="w-full px-3 py-2.5" />
                      </div>
                    </>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('paymentMode')} *</label>
                      <select value={vendorForm.paymentMode} onChange={(e) => setVendorForm((f) => ({ ...f, paymentMode: e.target.value }))} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg">
                        {PAYMENT_MODES.map((m) => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('transactionRef')}</label>
                      <ValidatedInput type="text" value={vendorForm.transactionRef} onChange={(v) => setVendorForm((f) => ({ ...f, transactionRef: v }))} fieldType="text" className="w-full px-3 py-2.5" />
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Modal>

      <Modal open={!!detailPayment} onClose={() => setDetailPayment(null)} title={t('paymentDetails')} size="lg" footer={
        <button onClick={() => setDetailPayment(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
          {t('close')}
        </button>
      }>
        {detailPayment && (
          <div className="space-y-4 text-sm">
            <div className="space-y-3">
              <p><span className="font-medium text-slate-700">{t('employeeType')}:</span> {getTypeLabel(detailPayment.type)}</p>
              <p><span className="font-medium text-slate-700">{detailPayment.type === 'vendor' ? t('vendor') : t('employeeName')}:</span> {detailPayment.name}</p>
              <p><span className="font-medium text-slate-700">{t('month')}:</span> {formatMonth(detailPayment.month)}</p>
              <p><span className="font-medium text-slate-700">{t('totalPayable')}:</span> ₹{formatAmount(detailPayment.totalPayable)}</p>
              <p><span className="font-medium text-slate-700">{t('paymentAmount')}:</span> ₹{formatAmount(detailPayment.paymentAmount)}</p>
              <p><span className="font-medium text-slate-700">{t('paymentMode')}:</span> {formatMode(detailPayment.paymentMode)}</p>
            </div>
            {detailLoading ? (
              <p className="text-slate-500">{t('loading')}</p>
            ) : detailPaymentFull && detailPayment.type === 'contractor' && (detailPaymentFull.workRecordRefs as { workRecord?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string }; workItems?: WorkItemRow[]; totalAmount?: number } }[])?.length > 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                <p className="font-medium text-slate-800">{t('calculationBreakup')}</p>
                {(detailPaymentFull.workRecordRefs as { workRecord?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string }; workItems?: WorkItemRow[]; totalAmount?: number }; totalAmount?: number }[]).map((ref: { workRecord?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string }; workItems?: WorkItemRow[]; totalAmount?: number }; totalAmount?: number }, i: number) => {
                  const wr = ref.workRecord;
                  if (!wr) return null;
                  const styleLabel = wr.styleOrder ? ` (${t('styleOrder')}: ${wr.styleOrder.styleCode}${wr.styleOrder.brand ? ` - ${wr.styleOrder.brand}` : ''})` : '';
                  return (
                    <div key={i} className="border-l-2 border-slate-300 pl-3 text-sm">
                      <p className="font-medium text-slate-700">{(wr.branch as { name?: string })?.name || t('workRecord')}{styleLabel}</p>
                      {(wr.workItems || []).map((item: WorkItemRow, j: number) => (
                        <p key={j} className="text-slate-600 ml-2">
                          {item.rateName}: {item.quantity} × ₹{formatAmount(item.ratePerUnit)} = ₹{formatAmount(item.amount)}
                        </p>
                      ))}
                      <p className="text-slate-800 font-medium mt-1">₹{formatAmount(wr.totalAmount ?? ref.totalAmount ?? 0)}</p>
                    </div>
                  );
                })}
              </div>
            ) : detailPaymentFull && detailPayment.type === 'vendor' && (detailPaymentFull.vendorWorkOrderRefs as { vendorWorkOrder?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string }; workItems?: VendorWorkItemRow[]; totalAmount?: number } }[])?.length > 0 ? (
              <div className="p-4 bg-slate-50 rounded-xl space-y-3">
                <p className="font-medium text-slate-800">{t('calculationBreakup')}</p>
                {(detailPaymentFull.vendorWorkOrderRefs as { vendorWorkOrder?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string }; workItems?: VendorWorkItemRow[]; totalAmount?: number }; totalAmount?: number }[]).map((ref: { vendorWorkOrder?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string }; workItems?: VendorWorkItemRow[]; totalAmount?: number }; totalAmount?: number }, i: number) => {
                  const wo = ref.vendorWorkOrder;
                  if (!wo) return null;
                  const styleLabel = wo.styleOrder ? ` (${t('styleOrder')}: ${wo.styleOrder.styleCode}${wo.styleOrder.brand ? ` - ${wo.styleOrder.brand}` : ''})` : '';
                  return (
                    <div key={i} className="border-l-2 border-slate-300 pl-3 text-sm">
                      <p className="font-medium text-slate-700">{(wo.branch as { name?: string })?.name || t('vendorWorkOrders')}{styleLabel}</p>
                      {(wo.workItems || []).map((item: VendorWorkItemRow, j: number) => (
                        <p key={j} className="text-slate-600 ml-2">
                          {item.rateName}: {item.quantity} × ₹{formatAmount(item.ratePerUnit)} = ₹{formatAmount(item.amount)}
                        </p>
                      ))}
                      <p className="text-slate-800 font-medium mt-1">₹{formatAmount(wo.totalAmount ?? ref.totalAmount ?? 0)}</p>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {carryModal && (
        <Modal open={!!carryModal} onClose={() => setCarryModal(null)} title={t('remainingAmount')} size="md" footer={
          <div className="flex gap-3 justify-end">
            <button onClick={() => setCarryModal(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50">
              {t('cancel')}
            </button>
            <button onClick={() => carryModal.onConfirm(0, '')} className="px-4 py-2.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-medium">
              {t('makeZero')}
            </button>
            <button onClick={() => { const amt = parseFloat((document.getElementById('carry-amount') as HTMLInputElement)?.value || '0') || 0; const remarks = (document.getElementById('carry-remarks') as HTMLInputElement)?.value || ''; carryModal.onConfirm(amt, remarks); }} className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium">
              {t('carryForward')}
            </button>
          </div>
        }>
          <p className="text-slate-600 mb-4">{t('remainingDue')}: ₹{formatAmount(carryModal.remaining)}. {t('carryForwardQuestion')}</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('carryForwardAmount')}</label>
              <input type="number" id="carry-amount" defaultValue={carryModal.remaining} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('remarks')}</label>
              <input type="text" id="carry-remarks" className="w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder={t('optionalRemarks')} />
            </div>
          </div>
        </Modal>
      )}

      <SaveOverlay show={saving} label={t('saving')} />
    </div>
  );
}
