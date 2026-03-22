'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import Modal from '@/components/Modal';
import SaveOverlay from '@/components/SaveOverlay';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import ListToolbar from '@/components/ListToolbar';
import { DataTable, DataTableHeader, DataTableHead, DataTableBody, DataTableRow, DataTableCell, DataTableEmpty } from '@/components/ui/DataTable';
import { PageLoader, Skeleton } from '@/components/Skeleton';
import { useEmployees, usePayments, useVendorPayments, useBranches, useDepartments, useVendors } from '@/lib/hooks/useApi';
import ValidatedInput from '@/components/ValidatedInput';
import { formatMonth, formatAmount, formatStyleOrderDisplay, roundAmount, roundDays } from '@/lib/utils';
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
  multiplier?: number;
}

interface WorkRecordCalc {
  _id: string;
  branch?: { name: string };
  month: string;
  styleOrder?: { styleCode: string; brand?: string; colour?: string } | null;
  workItems?: WorkItemRow[];
  totalAmount: number;
  isPaid?: boolean;
  isPendingApproval?: boolean;
}

interface FullTimeWorkRecordCalc {
  _id: string;
  branch?: { name: string };
  month: string;
  daysWorked: number;
  otHours: number;
  otAmount: number;
  totalAmount: number;
}

interface VendorWorkItemRow {
  rateName: string;
  quantity: number;
  ratePerUnit: number;
  amount: number;
  unit?: string;
  multiplier?: number;
}

interface VendorWorkOrderCalc {
  _id: string;
  branch?: { name: string };
  month: string;
  styleOrder?: { styleCode: string; brand?: string; colour?: string } | null;
  workItems?: VendorWorkItemRow[];
  totalAmount: number;
  isPaid?: boolean;
  isPendingApproval?: boolean;
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
    otherDeducted: 0,
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
    fullTimeWorkRecordIds: [] as string[],
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
    advanceDeducted: 0,
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
  const [calc, setCalc] = useState<{
    baseAmount: number;
    grossSalary?: number;
    pf?: number;
    esi?: number;
    other?: number;
    totalWorkingDays?: number;
    daysWorked?: number;
    otHours?: number;
    otAmount?: number;
    workRecords?: WorkRecordCalc[];
    fullTimeWorkRecords?: FullTimeWorkRecordCalc[];
  } | null>(null);
  const [vendorCalc, setVendorCalc] = useState<{ baseAmount: number; workOrders?: VendorWorkOrderCalc[] } | null>(null);
  const [advanceOutstanding, setAdvanceOutstanding] = useState(0);
  const [vendorAdvanceOutstanding, setVendorAdvanceOutstanding] = useState(0);

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

  useEffect(() => {
    if (addModal && modalRecipientType === 'vendor' && modalPaymentKind === 'job_order' && vendorForm.vendorId && vendorForm.month) {
      loadVendorCalculation(vendorForm.vendorId, vendorForm.month, vendorForm.vendorWorkOrderIds);
    }
  }, [addModal, modalRecipientType, modalPaymentKind, vendorForm.vendorId, vendorForm.month]);

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
    if (sortBy === 'amount-desc') return b.totalPayable - a.totalPayable;
    if (sortBy === 'amount-asc') return a.totalPayable - b.totalPayable;
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
      otherDeducted: 0,
      totalPayable: 0,
      paymentAmount: 0,
      paymentMode: 'cash',
      transactionRef: '',
      remainingAmount: 0,
      carriedForward: 0,
      carriedForwardRemarks: '',
      isAdvance: false,
      workRecordIds: [],
      fullTimeWorkRecordIds: [],
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
      advanceDeducted: 0,
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

  const loadEmpCalculation = async (empId: string, month: string, pType: 'contractor' | 'full_time', selectedWorkIds?: string[], selectedFtIds?: string[]) => {
    if (!empId || !month) return;
    if (pType === 'full_time') {
      const ftParam = selectedFtIds?.length ? `&selectedFullTimeWorkRecordIds=${selectedFtIds.join(',')}` : '';
      const [calcRes, advRes] = await Promise.all([
        fetch(`/api/payments/calculate?employeeId=${empId}&month=${month}&type=full_time${ftParam}`).then((r) => r.json()),
        fetch(`/api/payments/advance-outstanding?employeeId=${empId}&month=${month}`).then((r) => r.json()),
      ]);
      const outstanding = advRes.error ? 0 : (advRes.outstanding ?? 0);
      setAdvanceOutstanding(outstanding);
      if (!calcRes.error) {
        setCalc(calcRes);
        const ftRecords = calcRes.fullTimeWorkRecords || [];
        const unpaidFtIds = ftRecords.filter((r: FullTimeWorkRecordCalc & { isPaid?: boolean }) => !r.isPaid).map((r: FullTimeWorkRecordCalc) => r._id);
        const defaultSelected = selectedFtIds ?? unpaidFtIds;
        setEmpForm((f) => ({
          ...f,
          daysWorked: calcRes.daysWorked ?? 0,
          advanceDeducted: outstanding,
          baseAmount: calcRes.baseAmount ?? 0,
          pfDeducted: calcRes.pf ?? 0,
          esiDeducted: calcRes.esi ?? 0,
          otherDeducted: calcRes.other ?? 0,
          workRecordIds: [],
          fullTimeWorkRecordIds: defaultSelected,
        }));
      }
    } else {
      const wrParam = selectedWorkIds?.length ? `&selectedWorkRecordIds=${selectedWorkIds.join(',')}` : '';
      const [calcRes, advRes] = await Promise.all([
        fetch(`/api/payments/calculate?employeeId=${empId}&month=${month}&type=contractor${wrParam}`).then((r) => r.json()),
        fetch(`/api/payments/advance-outstanding?employeeId=${empId}&paymentType=contractor&month=${month}`).then((r) => r.json()),
      ]);
      const outstanding = advRes.error ? 0 : (advRes.outstanding ?? 0);
      setAdvanceOutstanding(outstanding);
      if (!calcRes.error) {
        setCalc(calcRes);
        const workRecords = calcRes.workRecords || [];
        const unpaidIds = workRecords.filter((r: WorkRecordCalc) => !r.isPaid && !r.isPendingApproval).map((r: WorkRecordCalc) => r._id);
        const defaultSelected = selectedWorkIds ?? unpaidIds;
        const base = calcRes.baseAmount ?? 0;
        const pf = calcRes.pfToDeduct ?? 0;
        const esi = calcRes.esiToDeduct ?? 0;
        const other = calcRes.otherToDeduct ?? 0;
        setEmpForm((f) => ({
          ...f,
          baseAmount: base,
          pfDeducted: pf,
          esiDeducted: esi,
          otherDeducted: other,
          advanceDeducted: outstanding,
          workRecordIds: defaultSelected,
        }));
      }
    }
  };

  const loadVendorCalculation = async (vendorId: string, month: string, selectedIds?: string[]) => {
    if (!vendorId || !month) {
      setVendorCalc(null);
      setVendorAdvanceOutstanding(0);
      return;
    }
    const voParam = selectedIds?.length ? `&selectedVendorWorkOrderIds=${selectedIds.join(',')}` : '';
    const [calcRes, advRes] = await Promise.all([
      fetch(`/api/vendor-payments/calculate?vendorId=${vendorId}&month=${month}${voParam}`).then((r) => r.json()),
      fetch(`/api/vendor-payments/advance-outstanding?vendorId=${vendorId}&month=${month}`).then((r) => r.json()),
    ]);
    const outstanding = advRes.error ? 0 : (advRes.outstanding ?? 0);
    setVendorAdvanceOutstanding(outstanding);
    if (calcRes.error) {
      setVendorCalc(null);
    } else {
      const workOrders = calcRes.workOrders || [];
      const unpaidIds = workOrders.filter((r: VendorWorkOrderCalc) => !r.isPaid && !r.isPendingApproval).map((r: VendorWorkOrderCalc) => r._id);
      const defaultSelected = selectedIds ?? unpaidIds;
      const base = calcRes.baseAmount ?? 0;
      setVendorCalc({ baseAmount: base, workOrders });
      setVendorForm((f) => ({
        ...f,
        baseAmount: base,
        advanceDeducted: outstanding,
        totalPayable: base + f.addDeductAmount - outstanding,
        vendorWorkOrderIds: defaultSelected,
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
      ? roundAmount((calc?.baseAmount ?? 0) + (calc?.otAmount ?? 0) + empForm.addDeductAmount - (empForm.advanceDeducted ?? 0))
      : roundAmount(empForm.baseAmount + empForm.addDeductAmount - empForm.pfDeducted - empForm.esiDeducted - (empForm.otherDeducted ?? 0) - (empForm.advanceDeducted ?? 0));
  const paymentAmountEmp = totalPayableEmp;
  const remainingEmp = 0;

  const handleEmpJobOrderSubmit = async () => {
    doEmpSubmit();
  };

  const doEmpSubmit = async () => {
    setSaving(true);
    try {
      const total = totalPayableEmp;
      const base = modalRecipientType === 'full_time' ? (calc?.baseAmount ?? 0) : empForm.baseAmount;
      const twd = roundDays(calc?.totalWorkingDays ?? 0);
      const dw = roundDays(empForm.daysWorked ?? calc?.daysWorked ?? 0);
      const contractorWorkRecordIds =
        empForm.paymentType === 'contractor'
          ? empForm.workRecordIds.filter((id) => {
              const wr = (calc?.workRecords as (WorkRecordCalc & { isPendingApproval?: boolean })[] | undefined)?.find((r) => r._id === id);
              return wr && !wr.isPaid && !wr.isPendingApproval;
            })
          : [];
      const payload: Record<string, unknown> = {
        employeeId: empForm.employeeId,
        paymentType: empForm.paymentType,
        month: empForm.month,
        baseAmount: base,
        addDeductAmount: empForm.addDeductAmount,
        addDeductRemarks: empForm.addDeductRemarks,
        pfDeducted: empForm.pfDeducted,
        esiDeducted: empForm.esiDeducted,
        otherDeducted: empForm.otherDeducted ?? 0,
        advanceDeducted: empForm.advanceDeducted ?? 0,
        totalPayable: total,
        paymentAmount: paymentAmountEmp,
        paymentMode: empForm.paymentMode,
        transactionRef: empForm.transactionRef,
        remainingAmount: 0,
        carriedForward: 0,
        carriedForwardRemarks: '',
        isAdvance: false,
        workRecordIds: contractorWorkRecordIds,
        fullTimeWorkRecordIds: empForm.paymentType === 'full_time' ? empForm.fullTimeWorkRecordIds : [],
      };
      if (empForm.paymentType === 'full_time') {
        (payload as Record<string, unknown>).daysWorked = dw;
        (payload as Record<string, unknown>).totalWorkingDays = twd;
        (payload as Record<string, unknown>).otHours = roundAmount(calc?.otHours ?? 0);
        (payload as Record<string, unknown>).otAmount = roundAmount(calc?.otAmount ?? 0);
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

  const vendorTotalPayable = vendorForm.baseAmount + vendorForm.addDeductAmount - (vendorForm.advanceDeducted ?? 0);

  const handleVendorJobOrderSubmit = async () => {
    if (vendorForm.addDeductAmount !== 0 && !(vendorForm.addDeductRemarks || '').trim()) {
      toast.error(t('mandatoryForAddDeduct') || t('remarksRequiredWhenRateChanged'));
      return;
    }
    const validVendorWorkOrderIds = (vendorCalc?.workOrders ?? []).filter(
      (wo) => vendorForm.vendorWorkOrderIds.includes(wo._id) && !wo.isPaid && !(wo as VendorWorkOrderCalc & { isPendingApproval?: boolean }).isPendingApproval
    ).map((wo) => wo._id);
    setSaving(true);
    try {
      const res = await fetch('/api/vendor-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...vendorForm,
          paymentType: 'monthly',
          totalPayable: vendorTotalPayable,
          paymentAmount: vendorTotalPayable,
          advanceDeducted: vendorForm.advanceDeducted ?? 0,
          remainingAmount: 0,
          carriedForward: 0,
          carriedForwardRemarks: '',
          vendorWorkOrderIds: validVendorWorkOrderIds,
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
    { value: 'amount-desc', label: `${t('totalAmount')} (high–low)` },
    { value: 'amount-asc', label: `${t('totalAmount')} (low–high)` },
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
          <DataTable>
            <DataTableHeader>
              <tr>
                <DataTableHead>{t('type')}</DataTableHead>
                <DataTableHead>{filterEmployeeType === 'all' ? t('employeeName') : filterEmployeeType === 'vendor' ? t('vendor') : t('employeeName')}</DataTableHead>
                <DataTableHead>{t('month')}</DataTableHead>
                {(filterEmployeeType === 'full_time' || filterEmployeeType === 'all') && (
                  <DataTableHead>{t('daysWorked')}</DataTableHead>
                )}
                <DataTableHead align="right">{t('totalAmount')}</DataTableHead>
                <DataTableHead>{t('paymentMode')}</DataTableHead>
                <DataTableHead>{t('status')}</DataTableHead>
                <DataTableHead align="right">{t('actions')}</DataTableHead>
              </tr>
            </DataTableHeader>
            <DataTableBody>
              {filtered.length === 0 ? (
                <DataTableEmpty colSpan={(filterEmployeeType === 'full_time' || filterEmployeeType === 'all') ? 8 : 7}>{t('noData')}</DataTableEmpty>
              ) : (
                filtered.map((row) => (
                  <DataTableRow key={row._id}>
                    <DataTableCell>
                      <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-800">{getTypeLabel(row.type)}</span>
                    </DataTableCell>
                    <DataTableCell className="font-medium text-slate-800">{row.name}</DataTableCell>
                    <DataTableCell className="text-slate-600 text-sm">{formatMonth(row.month)}</DataTableCell>
                    {(filterEmployeeType === 'full_time' || filterEmployeeType === 'all') && (
                      <DataTableCell>
                        {(() => {
                          const d = getDisplayDays(row);
                          if (d) return <span className="font-medium">{d.days}{d.total != null ? ` / ${d.total}` : ''}</span>;
                          return <span className="text-slate-400">—</span>;
                        })()}
                      </DataTableCell>
                    )}
                    <DataTableCell align="right" className="font-medium">₹{formatAmount(row.totalPayable)}</DataTableCell>
                    <DataTableCell>{formatMode(row.paymentMode)}</DataTableCell>
                    <DataTableCell>
                      {row.status === 'due' ? (
                        <span className="text-uff-accent text-sm">₹{formatAmount(row.remainingAmount)} {t('due')}</span>
                      ) : row.status === 'advance' ? (
                        <span className="text-blue-600 text-sm">{t('advance')}</span>
                      ) : (
                        <span className="text-emerald-600 text-sm">{t('paid')}</span>
                      )}
                    </DataTableCell>
                    <DataTableCell align="right">
                      <button onClick={() => setDetailPayment(row)} className="inline-flex items-center px-3 py-1.5 rounded-lg border border-slate-300 bg-slate-50 text-slate-700 font-medium text-sm hover:bg-slate-100 transition">
                        {t('view')}
                      </button>
                    </DataTableCell>
                  </DataTableRow>
                ))
              )}
            </DataTableBody>
          </DataTable>
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
                <p className="mt-2 font-semibold text-slate-900">₹{formatAmount(row.totalPayable)}</p>
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
                    disabled={saving || !empForm.employeeId || !empForm.month || totalPayableEmp <= 0 || (empForm.addDeductAmount !== 0 && !empForm.addDeductRemarks?.trim())}
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
                    disabled={saving || !vendorForm.vendorId || !vendorForm.month || vendorTotalPayable <= 0}
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
              {/* Dropdowns at top - changing either resets the form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-slate-200">
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('selectRecipientType')}</label>
                  <select
                    value={modalRecipientType}
                    onChange={(e) => {
                      const val = e.target.value as RecipientType | '';
                      if (!val) return;
                      setModalRecipientType(val);
                      setEmpForm((f) => ({ ...f, paymentType: val === 'full_time' || val === 'contractor' ? val : f.paymentType }));
                      setCalc(null);
                      setVendorCalc(null);
                      setAdvanceOutstanding(0);
                      setEmpForm((prev) => ({
                        branchId: filterBranch,
                        departmentId: filterDepartment,
                        employeeId: '',
                        paymentType: val === 'full_time' || val === 'contractor' ? val : prev.paymentType,
                        month: getCurrentMonth(),
                        baseAmount: 0,
                        addDeductAmount: 0,
                        addDeductRemarks: '',
                        pfDeducted: 0,
                        esiDeducted: 0,
                        otherDeducted: 0,
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
                        fullTimeWorkRecordIds: [],
                        daysWorked: 0,
                        totalWorkingDays: 0,
                        advanceAmount: 0,
                        advanceReasons: '',
                      }));
                      setVendorForm((prev) => ({
                        ...prev,
                        vendorId: '',
                        baseAmount: 0,
                        totalPayable: 0,
                        paymentAmount: 0,
                        vendorWorkOrderIds: [],
                      }));
                    }}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg"
                  >
                    <option value="full_time">{t('fullTime')}</option>
                    <option value="contractor">{t('contractors')}</option>
                    <option value="vendor">{t('jobworkVendors')}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('payment')} {t('type')}</label>
                  <select
                    value={modalPaymentKind}
                    onChange={(e) => {
                      const val = e.target.value as PaymentKind | '';
                      if (!val) return;
                      setModalPaymentKind(val);
                      setCalc(null);
                      setVendorCalc(null);
                      setAdvanceOutstanding(0);
                      setEmpForm((prev) => ({
                        ...prev,
                        baseAmount: 0,
                        addDeductAmount: 0,
                        advanceDeducted: 0,
                        totalPayable: 0,
                        paymentAmount: 0,
                        workRecordIds: [],
                        daysWorked: 0,
                        advanceAmount: 0,
                      }));
                      setVendorForm((prev) => ({
                        ...prev,
                        baseAmount: 0,
                        totalPayable: 0,
                        paymentAmount: 0,
                        vendorWorkOrderIds: [],
                        advanceAmount: 0,
                      }));
                    }}
                    className="w-full px-3 py-2.5 border border-slate-300 rounded-lg"
                  >
                    <option value="advance">{t('advancePayment')}</option>
                    <option value="job_order">{t('paymentAgainstJobOrder')}</option>
                  </select>
                </div>
              </div>
              {canShowEmployeeForm && (
                <>
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
                          setEmpForm((f) => ({ ...f, employeeId: id, paymentType: modalRecipientType as 'contractor' | 'full_time', workRecordIds: [], fullTimeWorkRecordIds: [] }));
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
                      <input type="month" value={empForm.month} onChange={(e) => { const m = e.target.value; setEmpForm((f) => ({ ...f, month: m })); if (empForm.employeeId) loadEmpCalculation(empForm.employeeId, m, modalRecipientType as 'contractor' | 'full_time', empForm.workRecordIds, empForm.fullTimeWorkRecordIds); }} onBlur={() => empForm.employeeId && loadEmpCalculation(empForm.employeeId, empForm.month, modalRecipientType as 'contractor' | 'full_time', empForm.workRecordIds, empForm.fullTimeWorkRecordIds)} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg" />
                    </div>
                  </div>
                  {isAdvanceFlow ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('amount')} (₹) *</label>
                        <ValidatedInput type="text" inputMode="decimal" value={empForm.advanceAmount ? String(empForm.advanceAmount) : ''} onChange={(v) => setEmpForm((f) => ({ ...f, advanceAmount: parseFloat(v) || 0 }))} placeholderHint="e.g. 5000" fieldType="number" validate={(v) => v.trim() === '' || !isNaN(parseFloat(v))} className="w-full px-3 py-2.5" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('reasons')}</label>
                        <ValidatedInput type="text" value={empForm.advanceReasons} onChange={(v) => setEmpForm((f) => ({ ...f, advanceReasons: v }))} fieldType="text" placeholderHint="Optional" className="w-full px-3 py-2.5" />
                      </div>
                    </>
                  ) : (
                    <>
                      {modalRecipientType === 'full_time' && calc && (
                        <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                          <p className="text-sm font-medium text-slate-800">{t('workOrders')} – {t('selectPaymentAgainst')}</p>
                          {(calc.fullTimeWorkRecords && (calc.fullTimeWorkRecords as (FullTimeWorkRecordCalc & { isPaid?: boolean })[]).length > 0) ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {(calc.fullTimeWorkRecords as (FullTimeWorkRecordCalc & { isPaid?: boolean })[]).map((wr) => {
                              const isPaid = wr.isPaid ?? false;
                              const isSelected = empForm.fullTimeWorkRecordIds.includes(wr._id);
                              return (
                                <label key={wr._id} className={`flex items-start gap-3 p-2 rounded-lg border cursor-pointer ${isPaid ? 'bg-slate-100 border-slate-200 opacity-75' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isPaid}
                                    onChange={() => {
                                      if (isPaid) return;
                                      const next = isSelected ? empForm.fullTimeWorkRecordIds.filter((id) => id !== wr._id) : [...empForm.fullTimeWorkRecordIds, wr._id];
                                      setEmpForm((f) => ({ ...f, fullTimeWorkRecordIds: next }));
                                      loadEmpCalculation(empForm.employeeId, empForm.month, 'full_time', undefined, next);
                                    }}
                                    className="mt-1 rounded border-slate-300 text-uff-accent disabled:opacity-50"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700">{(wr.branch as { name?: string })?.name || t('workOrder')} – {wr.daysWorked} {t('daysWorked')}, {wr.otHours || 0} {t('otHours')}{isPaid ? ` (${t('paymentDone')})` : ''}</p>
                                    <p className="text-slate-600 text-sm">₹{formatAmount(wr.totalAmount || 0)}</p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                          ) : (
                            <p className="text-sm text-slate-600">{t('noWorkOrdersForMonth') || 'No work orders for this month. Add work orders in Work Orders.'}</p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">{t('daysWorked')}: {calc.daysWorked ?? 0} / {calc.totalWorkingDays ?? 0} | OT: {calc.otHours ?? 0}h = ₹{formatAmount(calc.otAmount ?? 0)}</p>
                        </div>
                      )}
                      {modalRecipientType === 'contractor' && calc?.workRecords && calc.workRecords.length > 0 && (
                        <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                          <p className="text-sm font-medium text-slate-800">{t('workOrders')} – {t('selectPaymentAgainst')}</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {(calc.workRecords as WorkRecordCalc[]).map((wr) => {
                              const isPaid = wr.isPaid ?? false;
                              const isPendingApproval = wr.isPendingApproval ?? false;
                              const isDisabled = isPaid || isPendingApproval;
                              const isSelected = empForm.workRecordIds.includes(wr._id);
                              const statusLabel = isPaid ? ` (${t('paid')})` : isPendingApproval ? ` (${t('awaitingApproval')})` : '';
                              return (
                                <label key={wr._id} className={`flex items-start gap-3 p-2 rounded-lg border cursor-pointer ${isDisabled ? 'bg-slate-100 border-slate-200 opacity-75' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isDisabled}
                                    onChange={() => {
                                      if (isDisabled) return;
                                      const next = isSelected ? empForm.workRecordIds.filter((id) => id !== wr._id) : [...empForm.workRecordIds, wr._id];
                                      setEmpForm((f) => ({ ...f, workRecordIds: next }));
                                      loadEmpCalculation(empForm.employeeId, empForm.month, 'contractor', next, undefined);
                                    }}
                                    className="mt-1 rounded border-slate-300 text-uff-accent disabled:opacity-50"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700">{(wr.branch as { name?: string })?.name || t('workRecord')}{wr.styleOrder ? ` – ${formatStyleOrderDisplay(wr.styleOrder.styleCode, wr.styleOrder.brand, wr.styleOrder.colour)}` : ''}{statusLabel}</p>
                                    {((wr.workItems || []).filter((item): item is WorkItemRow => !!item) as WorkItemRow[]).map((item: WorkItemRow, i: number) => (
                                      <p key={i} className="text-slate-600 text-xs ml-2">{item.rateName}: {item.quantity} × ₹{formatAmount(item.ratePerUnit)}</p>
                                    ))}
                                    <p className="text-slate-800 font-medium mt-0.5">₹{formatAmount(wr.totalAmount || 0)}</p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-800 mb-1.5">
                            {empForm.addDeductAmount > 0 ? t('addDeductProfit') : empForm.addDeductAmount < 0 ? t('addDeductLoss') : t('addDeduct')} (₹)
                          </label>
                          <ValidatedInput type="text" inputMode="decimal" value={empForm.addDeductAmount ? String(empForm.addDeductAmount) : ''} onChange={(v) => setEmpForm((f) => ({ ...f, addDeductAmount: parseFloat(v) || 0 }))} fieldType="number" validate={(v) => v.trim() === '' || !isNaN(parseFloat(v))} className="w-full px-3 py-2.5" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('remarks')}{empForm.addDeductAmount !== 0 ? ' *' : ''}</label>
                          <ValidatedInput type="text" value={empForm.addDeductRemarks} onChange={(v) => setEmpForm((f) => ({ ...f, addDeductRemarks: v }))} fieldType="text" placeholderHint={empForm.addDeductAmount !== 0 ? t('mandatoryForAddDeduct') || 'Required when Add/Deduct ≠ 0' : t('optionalRemarks') || 'Optional'} className={`w-full px-3 py-2.5 ${empForm.addDeductAmount !== 0 && !empForm.addDeductRemarks?.trim() ? 'border-amber-500' : ''}`} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('advanceDeducted')} (₹){advanceOutstanding > 0 && <span className="text-slate-500 text-xs ml-1">({t('outstanding')}: ₹{formatAmount(advanceOutstanding)})</span>}</label>
                          <ValidatedInput type="text" inputMode="decimal" value={empForm.advanceDeducted != null && empForm.advanceDeducted !== 0 ? String(empForm.advanceDeducted) : ''} onChange={(v) => setEmpForm((f) => ({ ...f, advanceDeducted: parseFloat(v) || 0 }))} fieldType="number" placeholderHint={advanceOutstanding > 0 ? String(advanceOutstanding) : '0'} className="w-full px-3 py-2.5" />
                        </div>
                      </div>
                      {modalRecipientType === 'full_time' && calc && (
                        <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 space-y-1.5 text-sm">
                          <p className="font-medium text-slate-800 mb-2">{t('calculationBreakup')}</p>
                          <p className="text-slate-700">{t('grossSalary') || 'Gross'}: ₹{formatAmount(calc.grossSalary ?? 0)}</p>
                          {(calc.otAmount ?? 0) > 0 && <p className="text-slate-700">+ {t('otHours')} / OT: ₹{formatAmount(calc.otAmount ?? 0)}</p>}
                          {(calc.pf ?? 0) > 0 && <p className="text-slate-600">− {t('pf')}: ₹{formatAmount(calc.pf ?? 0)}</p>}
                          {(calc.esi ?? 0) > 0 && <p className="text-slate-600">− {t('esi')}: ₹{formatAmount(calc.esi ?? 0)}</p>}
                          {(calc.other ?? 0) > 0 && <p className="text-slate-600">− {t('otherDeductions')}: ₹{formatAmount(calc.other ?? 0)}</p>}
                          {empForm.addDeductAmount !== 0 && <p className="text-slate-700">{empForm.addDeductAmount > 0 ? '+' : ''}{t('addDeduct')}: ₹{formatAmount(empForm.addDeductAmount)} {empForm.addDeductRemarks && `(${empForm.addDeductRemarks})`}</p>}
                          {(empForm.advanceDeducted ?? 0) > 0 && <p className="text-slate-600">− {t('advanceDeducted')}: ₹{formatAmount(empForm.advanceDeducted ?? 0)}</p>}
                        </div>
                      )}
                      {modalRecipientType === 'contractor' && (
                        <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 space-y-1.5 text-sm">
                          <p className="font-medium text-slate-800 mb-2">{t('calculationBreakup')}</p>
                          <p className="text-slate-700">{t('baseAmount')}: ₹{formatAmount(empForm.baseAmount ?? 0)}</p>
                          {(empForm.pfDeducted ?? 0) > 0 && <p className="text-slate-600">− {t('pf')}: ₹{formatAmount(empForm.pfDeducted ?? 0)}</p>}
                          {(empForm.esiDeducted ?? 0) > 0 && <p className="text-slate-600">− {t('esi')}: ₹{formatAmount(empForm.esiDeducted ?? 0)}</p>}
                          {(empForm.otherDeducted ?? 0) > 0 && <p className="text-slate-600">− {t('otherDeductions')}: ₹{formatAmount(empForm.otherDeducted ?? 0)}</p>}
                          {empForm.addDeductAmount !== 0 && <p className="text-slate-700">{empForm.addDeductAmount > 0 ? '+' : ''}{t('addDeduct')}: ₹{formatAmount(empForm.addDeductAmount)} {empForm.addDeductRemarks && `(${empForm.addDeductRemarks})`}</p>}
                          {(empForm.advanceDeducted ?? 0) > 0 && <p className="text-slate-600">− {t('advanceDeducted')}: ₹{formatAmount(empForm.advanceDeducted ?? 0)}</p>}
                        </div>
                      )}
                      <div className="p-4 bg-uff-accent/5 rounded-xl border border-uff-accent/20">
                        <p className="text-sm font-medium text-slate-700">{t('finalPayable')}</p>
                        <p className="text-2xl font-bold text-slate-900">₹{formatAmount(totalPayableEmp)}</p>
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
                      <input type="month" value={vendorForm.month} onChange={(e) => { const m = e.target.value; setVendorForm((f) => ({ ...f, month: m })); if (vendorForm.vendorId) loadVendorCalculation(vendorForm.vendorId, m); }} className="w-full px-3 py-2.5 border border-slate-300 rounded-lg" />
                    </div>
                  </div>
                  {isAdvanceFlow ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('amount')} (₹) *</label>
                        <ValidatedInput type="text" inputMode="decimal" value={vendorForm.advanceAmount ? String(vendorForm.advanceAmount) : ''} onChange={(v) => setVendorForm((f) => ({ ...f, advanceAmount: parseFloat(v) || 0 }))} placeholderHint="e.g. 5000" fieldType="number" validate={(v) => v.trim() === '' || !isNaN(parseFloat(v))} className="w-full px-3 py-2.5" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('reasons')}</label>
                        <ValidatedInput type="text" value={vendorForm.advanceRemarks} onChange={(v) => setVendorForm((f) => ({ ...f, advanceRemarks: v }))} fieldType="text" className="w-full px-3 py-2.5" />
                      </div>
                    </>
                  ) : (
                    <>
                      {vendorCalc?.workOrders && vendorCalc.workOrders.length > 0 && (
                        <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                          <p className="text-sm font-medium text-slate-800">{t('workOrders')} – {t('selectPaymentAgainst')}</p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {(vendorCalc.workOrders as VendorWorkOrderCalc[]).map((wo) => {
                              const isPaid = wo.isPaid ?? false;
                              const isPendingApproval = wo.isPendingApproval ?? false;
                              const isDisabled = isPaid || isPendingApproval;
                              const isSelected = vendorForm.vendorWorkOrderIds.includes(wo._id);
                              const statusLabel = isPaid ? ` (${t('paid')})` : isPendingApproval ? ` (${t('awaitingApproval')})` : '';
                              return (
                                <label key={wo._id} className={`flex items-start gap-3 p-2 rounded-lg border cursor-pointer ${isDisabled ? 'bg-slate-100 border-slate-200 opacity-75' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isDisabled}
                                    onChange={() => {
                                      if (isDisabled) return;
                                      const next = isSelected ? vendorForm.vendorWorkOrderIds.filter((id) => id !== wo._id) : [...vendorForm.vendorWorkOrderIds, wo._id];
                                      setVendorForm((f) => ({ ...f, vendorWorkOrderIds: next }));
                                      loadVendorCalculation(vendorForm.vendorId, vendorForm.month, next);
                                    }}
                                    className="mt-1 rounded border-slate-300 text-uff-accent disabled:opacity-50"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-slate-700">{(wo.branch as { name?: string })?.name || t('vendorWorkOrders')}{wo.styleOrder ? ` – ${formatStyleOrderDisplay(wo.styleOrder.styleCode, wo.styleOrder.brand, wo.styleOrder.colour)}` : ''}{statusLabel}</p>
                                    {((wo.workItems || []).filter((item): item is VendorWorkItemRow => !!item) as VendorWorkItemRow[]).map((item: VendorWorkItemRow, i: number) => (
                                      <p key={i} className="text-slate-600 text-xs ml-2">{item.rateName}: {item.quantity} × ₹{formatAmount(item.ratePerUnit)}</p>
                                    ))}
                                    <p className="text-slate-800 font-medium mt-0.5">₹{formatAmount(wo.totalAmount || 0)}</p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-slate-800 mb-1.5">
                            {vendorForm.addDeductAmount > 0 ? t('addDeductProfit') : vendorForm.addDeductAmount < 0 ? t('addDeductLoss') : t('addDeduct')} (₹)
                          </label>
                          <ValidatedInput type="text" inputMode="decimal" value={vendorForm.addDeductAmount ? String(vendorForm.addDeductAmount) : ''} onChange={(v) => setVendorForm((f) => ({ ...f, addDeductAmount: parseFloat(v) || 0 }))} fieldType="number" validate={(v) => v.trim() === '' || !isNaN(parseFloat(v))} className="w-full px-3 py-2.5" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('remarks')}{vendorForm.addDeductAmount !== 0 ? ' *' : ''}</label>
                          <ValidatedInput type="text" value={vendorForm.addDeductRemarks} onChange={(v) => setVendorForm((f) => ({ ...f, addDeductRemarks: v }))} fieldType="text" placeholderHint={vendorForm.addDeductAmount !== 0 ? t('mandatoryForAddDeduct') || 'Required when Add/Deduct ≠ 0' : t('optionalRemarks') || 'Optional'} className={`w-full px-3 py-2.5 ${vendorForm.addDeductAmount !== 0 && !vendorForm.addDeductRemarks?.trim() ? 'border-amber-500' : ''}`} />
                        </div>
                        <div className="sm:col-span-2">
                          <label className="block text-sm font-medium text-slate-800 mb-1.5">{t('advanceDeducted')} (₹){vendorAdvanceOutstanding > 0 && <span className="text-slate-500 text-xs ml-1">({t('outstanding')}: ₹{formatAmount(vendorAdvanceOutstanding)})</span>}</label>
                          <ValidatedInput type="text" inputMode="decimal" value={vendorForm.advanceDeducted != null && vendorForm.advanceDeducted !== 0 ? String(vendorForm.advanceDeducted) : ''} onChange={(v) => setVendorForm((f) => ({ ...f, advanceDeducted: parseFloat(v) || 0 }))} fieldType="number" placeholderHint={vendorAdvanceOutstanding > 0 ? String(vendorAdvanceOutstanding) : '0'} className="w-full px-3 py-2.5" />
                        </div>
                      </div>
                      <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 space-y-1.5 text-sm">
                        <p className="font-medium text-slate-800 mb-2">{t('calculationBreakup')}</p>
                        <p className="text-slate-700">{t('baseAmount')}: ₹{formatAmount(vendorForm.baseAmount ?? 0)}</p>
                        {vendorForm.addDeductAmount !== 0 && <p className="text-slate-700">{vendorForm.addDeductAmount > 0 ? '+' : ''}{t('addDeduct')}: ₹{formatAmount(vendorForm.addDeductAmount)} {vendorForm.addDeductRemarks && `(${vendorForm.addDeductRemarks})`}</p>}
                        {(vendorForm.advanceDeducted ?? 0) > 0 && <p className="text-slate-600">− {t('advanceDeducted')}: ₹{formatAmount(vendorForm.advanceDeducted ?? 0)}</p>}
                      </div>
                      <div className="p-4 bg-uff-accent/5 rounded-xl border border-uff-accent/20">
                        <p className="text-sm font-medium text-slate-700">{t('finalPayable')}</p>
                        <p className="text-2xl font-bold text-slate-900">₹{formatAmount(vendorTotalPayable)}</p>
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

      <Modal open={!!detailPayment} onClose={() => setDetailPayment(null)} title={t('paymentDetails')} size="3xl" footer={
        <button onClick={() => setDetailPayment(null)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
          {t('close')}
        </button>
      }>
        {detailPayment && (
          <div className="space-y-5 text-sm max-h-[75vh] overflow-y-auto">
            {/* Header: same as add form */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-slate-50 rounded-xl">
              <p><span className="font-medium text-slate-700">{t('employeeType')}:</span> {getTypeLabel(detailPayment.type)}</p>
              <p><span className="font-medium text-slate-700">{detailPayment.type === 'vendor' ? t('vendor') : t('employeeName')}:</span> {detailPayment.name}</p>
              <p><span className="font-medium text-slate-700">{t('month')}:</span> {formatMonth(detailPayment.month)}</p>
              <p><span className="font-medium text-slate-700">{t('paymentMode')}:</span> {formatMode(detailPayment.paymentMode)}</p>
              {(detailPayment.raw as { transactionRef?: string })?.transactionRef && (
                <p><span className="font-medium text-slate-700">{t('transactionRef')}:</span> {(detailPayment.raw as { transactionRef: string }).transactionRef}</p>
              )}
              {(detailPayment.raw as { paidAt?: string })?.paidAt && (
                <p><span className="font-medium text-slate-700">Paid At:</span> {new Date((detailPayment.raw as { paidAt: string }).paidAt).toLocaleString()}</p>
              )}
            </div>

            {detailLoading ? (
              <p className="text-slate-500">{t('loading')}</p>
            ) : detailPaymentFull ? (
              <>
                {/* ADVANCE PAYMENT */}
                {detailPayment.isAdvance && (
                  <div className="p-4 bg-slate-50 rounded-xl">
                    <p><span className="font-semibold text-slate-800">{t('advance')}:</span> ₹{formatAmount((detailPaymentFull.paymentAmount as number) ?? 0)}</p>
                    {(detailPaymentFull.addDeductRemarks as string) && <p className="text-slate-600 mt-1">{(detailPaymentFull.addDeductRemarks as string)}</p>}
                  </div>
                )}

                {/* WORK ORDERS - Contractor (same layout as add form) */}
                {!detailPayment.isAdvance && detailPayment.type === 'contractor' && (
                  <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                    <p className="text-sm font-medium text-slate-800">{t('workOrders')} – {t('paymentAgainstJobOrder') || 'Payment against'}</p>
                    {(detailPaymentFull.workRecordRefs as { workRecord?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string; colour?: string }; workItems?: WorkItemRow[]; totalAmount?: number }; totalAmount?: number }[])?.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(detailPaymentFull.workRecordRefs as { workRecord?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string; colour?: string }; workItems?: WorkItemRow[]; totalAmount?: number }; totalAmount?: number }[]).map((ref: { workRecord?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string; colour?: string }; workItems?: WorkItemRow[]; totalAmount?: number }; totalAmount?: number }, i: number) => {
                          const wr = ref.workRecord;
                          if (!wr) return null;
                          const styleLabel = wr.styleOrder ? ` – ${formatStyleOrderDisplay(wr.styleOrder.styleCode, wr.styleOrder.brand, wr.styleOrder.colour)}` : '';
                          return (
                            <div key={i} className="flex items-start gap-3 p-2 rounded-lg border bg-white border-slate-200">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700">{(wr.branch as { name?: string })?.name || t('workRecord')}{styleLabel}</p>
                                {((wr.workItems || []).filter((item): item is WorkItemRow => !!item) as WorkItemRow[]).map((item: WorkItemRow, j: number) => (
                                  <p key={j} className="text-slate-600 text-xs ml-2">{item.rateName}: {item.quantity}{(item.multiplier ?? 1) !== 1 ? ` × ${item.multiplier}` : ''} × ₹{formatAmount(item.ratePerUnit)} = ₹{formatAmount(item.amount)}</p>
                                ))}
                                <p className="text-slate-800 font-medium mt-0.5">₹{formatAmount(wr.totalAmount ?? ref.totalAmount ?? 0)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-600">{t('noWorkOrdersForMonth') || 'No work orders.'}</p>
                    )}
                  </div>
                )}

                {/* WORK ORDERS - Full-time (same layout as add form) */}
                {!detailPayment.isAdvance && detailPayment.type === 'full_time' && (
                  <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                    <p className="text-sm font-medium text-slate-800">{t('workOrders')} – {t('selectPaymentAgainst')}</p>
                    {(detailPaymentFull.fullTimeWorkRecordRefs as { fullTimeWorkRecord?: { branch?: { name: string }; daysWorked?: number; otHours?: number; otAmount?: number; totalAmount?: number }; daysWorked?: number; otHours?: number; otAmount?: number }[])?.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(detailPaymentFull.fullTimeWorkRecordRefs as { fullTimeWorkRecord?: { branch?: { name: string }; daysWorked?: number; otHours?: number; otAmount?: number; totalAmount?: number }; daysWorked?: number; otHours?: number; otAmount?: number }[]).map((ref: { fullTimeWorkRecord?: { branch?: { name: string }; daysWorked?: number; otHours?: number; otAmount?: number; totalAmount?: number }; daysWorked?: number; otHours?: number; otAmount?: number }, i: number) => {
                          const ft = ref.fullTimeWorkRecord;
                          if (!ft) return null;
                          return (
                            <div key={i} className="flex items-start gap-3 p-2 rounded-lg border bg-white border-slate-200">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700">{(ft.branch as { name?: string })?.name || t('branch')} – {ref.daysWorked ?? ft.daysWorked ?? 0} {t('daysWorked')}, {ref.otHours ?? ft.otHours ?? 0} {t('otHours')}</p>
                                <p className="text-slate-800 font-medium mt-0.5">₹{formatAmount(ft.totalAmount ?? 0)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-600">{t('noWorkOrdersForMonth') || 'No work orders.'}</p>
                    )}
                    {(() => {
                      const dw = detailPaymentFull.daysWorked as number | undefined;
                      const tw = detailPaymentFull.totalWorkingDays as number | undefined;
                      const otH = detailPaymentFull.otHours as number | undefined;
                      const otAmt = (detailPaymentFull.otAmount as number | undefined) ?? 0;
                      if (dw == null && tw == null) return null;
                      return (
                        <p className="text-xs text-slate-500 mt-1">
                          {t('daysWorked')}: {dw ?? '—'} / {tw ?? '—'} | OT: {otH ?? 0}h = ₹{formatAmount(otAmt)}
                        </p>
                      );
                    })()}
                  </div>
                )}

                {/* WORK ORDERS - Vendor (same layout as add form) */}
                {!detailPayment.isAdvance && detailPayment.type === 'vendor' && (
                  <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                    <p className="text-sm font-medium text-slate-800">{t('workOrders')} – {t('paymentAgainstJobOrder') || 'Payment against'}</p>
                    {(detailPaymentFull.vendorWorkOrderRefs as { vendorWorkOrder?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string; colour?: string }; workItems?: VendorWorkItemRow[]; totalAmount?: number; extraAmount?: number }; totalAmount?: number }[])?.length > 0 ? (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {(detailPaymentFull.vendorWorkOrderRefs as { vendorWorkOrder?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string; colour?: string }; workItems?: VendorWorkItemRow[]; totalAmount?: number; extraAmount?: number }; totalAmount?: number }[]).map((ref: { vendorWorkOrder?: { branch?: { name: string }; styleOrder?: { styleCode: string; brand?: string; colour?: string }; workItems?: VendorWorkItemRow[]; totalAmount?: number; extraAmount?: number }; totalAmount?: number }, i: number) => {
                          const wo = ref.vendorWorkOrder;
                          if (!wo) return null;
                          const styleLabel = wo.styleOrder ? ` – ${formatStyleOrderDisplay(wo.styleOrder.styleCode, wo.styleOrder.brand, wo.styleOrder.colour)}` : '';
                          return (
                            <div key={i} className="flex items-start gap-3 p-2 rounded-lg border bg-white border-slate-200">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-700">{(wo.branch as { name?: string })?.name || t('vendorWorkOrders')}{styleLabel}</p>
                                {((wo.workItems || []).filter((item): item is VendorWorkItemRow => !!item) as VendorWorkItemRow[]).map((item: VendorWorkItemRow, j: number) => (
                                  <p key={j} className="text-slate-600 text-xs ml-2">{item.rateName}: {item.quantity}{(item.multiplier ?? 1) !== 1 ? ` × ${item.multiplier}` : ''} × ₹{formatAmount(item.ratePerUnit)} = ₹{formatAmount(item.amount)}</p>
                                ))}
                                {(wo.extraAmount ?? 0) > 0 && <p className="text-slate-600 text-xs ml-2">{t('extraAmount')}: +₹{formatAmount(wo.extraAmount ?? 0)}</p>}
                                <p className="text-slate-800 font-medium mt-0.5">₹{formatAmount(wo.totalAmount ?? ref.totalAmount ?? 0)}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-slate-600">{t('noWorkOrdersForMonth') || 'No work orders.'}</p>
                    )}
                  </div>
                )}

                {/* CALCULATION BREAKUP - Same as add form (slate-100 box) */}
                {!detailPayment.isAdvance && (
                  <div className="p-4 bg-slate-100 rounded-xl border border-slate-200 space-y-1.5 text-sm">
                    <p className="font-medium text-slate-800 mb-2">{t('calculationBreakup')}</p>
                    {detailPayment.type === 'full_time' ? (
                      <>
                        <p className="text-slate-700">{t('grossSalary') || 'Gross'}: ₹{formatAmount(roundAmount(((detailPaymentFull.baseAmount as number) ?? 0) + ((detailPaymentFull.pfDeducted as number) ?? 0) + ((detailPaymentFull.esiDeducted as number) ?? 0) + ((detailPaymentFull.otherDeducted as number) ?? 0)))}</p>
                        {((detailPaymentFull.otAmount as number) ?? 0) > 0 && <p className="text-slate-700">+ {t('otHours')} / OT: ₹{formatAmount(detailPaymentFull.otAmount as number)}</p>}
                        {((detailPaymentFull.pfDeducted as number) ?? 0) > 0 && <p className="text-slate-600">− {t('pf')}: ₹{formatAmount(detailPaymentFull.pfDeducted as number)}</p>}
                        {((detailPaymentFull.esiDeducted as number) ?? 0) > 0 && <p className="text-slate-600">− {t('esi')}: ₹{formatAmount(detailPaymentFull.esiDeducted as number)}</p>}
                        {((detailPaymentFull.otherDeducted as number) ?? 0) > 0 && <p className="text-slate-600">− {t('otherDeductions')}: ₹{formatAmount(detailPaymentFull.otherDeducted as number)}</p>}
                        {((detailPaymentFull.addDeductAmount as number) ?? 0) !== 0 && <p className="text-slate-700">{((detailPaymentFull.addDeductAmount as number) ?? 0) > 0 ? '+' : ''}{t('addDeduct')}: ₹{formatAmount(detailPaymentFull.addDeductAmount as number)} {(detailPaymentFull.addDeductRemarks as string) && `(${detailPaymentFull.addDeductRemarks})`}</p>}
                        {((detailPaymentFull.advanceDeducted as number) ?? 0) > 0 && <p className="text-slate-600">− {t('advanceDeducted')}: ₹{formatAmount(detailPaymentFull.advanceDeducted as number)}</p>}
                      </>
                    ) : (
                      <>
                        <p className="text-slate-700">{t('baseAmount')}: ₹{formatAmount((detailPaymentFull.baseAmount as number) ?? 0)}</p>
                        {((detailPaymentFull.pfDeducted as number) ?? 0) > 0 && <p className="text-slate-600">− {t('pf')}: ₹{formatAmount(detailPaymentFull.pfDeducted as number)}</p>}
                        {((detailPaymentFull.esiDeducted as number) ?? 0) > 0 && <p className="text-slate-600">− {t('esi')}: ₹{formatAmount(detailPaymentFull.esiDeducted as number)}</p>}
                        {((detailPaymentFull.otherDeducted as number) ?? 0) > 0 && <p className="text-slate-600">− {t('otherDeductions')}: ₹{formatAmount(detailPaymentFull.otherDeducted as number)}</p>}
                        {((detailPaymentFull.addDeductAmount as number) ?? 0) !== 0 && <p className="text-slate-700">{((detailPaymentFull.addDeductAmount as number) ?? 0) > 0 ? '+' : ''}{t('addDeduct')}: ₹{formatAmount(detailPaymentFull.addDeductAmount as number)} {(detailPaymentFull.addDeductRemarks as string) && `(${detailPaymentFull.addDeductRemarks})`}</p>}
                        {((detailPaymentFull.advanceDeducted as number) ?? 0) > 0 && <p className="text-slate-600">− {t('advanceDeducted')}: ₹{formatAmount(detailPaymentFull.advanceDeducted as number)}</p>}
                      </>
                    )}
                  </div>
                )}

                {/* FINAL PAYABLE - Same accent box as add form */}
                {!detailPayment.isAdvance && (
                  <div className="p-4 bg-uff-accent/5 rounded-xl border border-uff-accent/20">
                    <p className="text-sm font-medium text-slate-700">{t('finalPayable')}</p>
                    <p className="text-2xl font-bold text-slate-900">₹{formatAmount((detailPaymentFull.totalPayable as number) ?? 0)}</p>
                    <p className="text-slate-700 mt-1">{t('paymentAmount')}: ₹{formatAmount((detailPaymentFull.paymentAmount as number) ?? 0)}</p>
                    {((detailPaymentFull.remainingAmount as number) ?? 0) > 0 && (
                      <p className="text-amber-700 mt-1"><span className="font-medium">{t('remainingDue')}:</span> ₹{formatAmount(detailPaymentFull.remainingAmount as number)}</p>
                    )}
                    {((detailPaymentFull.carriedForward as number) ?? 0) > 0 && (
                      <p className="text-slate-600 mt-1">{t('carryForward')}: ₹{formatAmount(detailPaymentFull.carriedForward as number)} {(detailPaymentFull.carriedForwardRemarks as string) && `(${detailPaymentFull.carriedForwardRemarks})`}</p>
                    )}
                  </div>
                )}
              </>
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
