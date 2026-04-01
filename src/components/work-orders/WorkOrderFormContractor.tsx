'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import ValidatedInput from '@/components/ValidatedInput';
import { useBranches, useDepartments, useEmployees, useRates, useStyleOrdersByBranchMonth } from '@/lib/hooks/useApi';
import { formatAmount, formatStyleOrderDisplay } from '@/lib/utils';
import { toast } from '@/lib/toast';
import SaveOverlay from '@/components/SaveOverlay';
import SearchableSelect from '@/components/ui/SearchableSelect';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface WorkOrderFormContractorProps {
  mode: 'create' | 'edit' | 'view';
  record?: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
  onSwitchToEdit?: () => void;
}

interface Employee {
  _id: string;
  name: string;
  employeeType: string;
  branches: unknown[];
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
    entries: { rateMasterId: string; totalOrderQuantity: number; availableQuantity: number }[];
  } | null;
}

export default function WorkOrderFormContractor({ mode, record, onClose, onSaved, onSwitchToEdit }: WorkOrderFormContractorProps) {
  const { t } = useApp();
  const { user } = useAuth();
  const isEmployee = !!user?.employeeId;
  const canAdd = ['admin', 'finance', 'hr'].includes(user?.role || '');

  const [form, setForm] = useState({
    employeeId: '',
    employeeName: '',
    branchId: '',
    branchName: '',
    departmentId: '',
    departmentName: '',
    month: getCurrentMonth(),
    styleOrderId: '',
    styleOrderCode: '',
    colour: '',
    workItems: {} as Record<string, { quantity: number; defaultQuantity: number; ratePerUnit: number; defaultRatePerUnit: number; remarks: string }>,
    otHours: 0,
    otAmount: 0,
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  const { branches } = useBranches(false);
  const { departments } = useDepartments(false);
  const { employees: formEmpList } = useEmployees(false, {
    limit: 0,
    branchId: form.branchId || undefined,
    departmentId: form.departmentId || undefined,
  });
  const employeesForBranchAndDepartment = (Array.isArray(formEmpList) ? formEmpList : []).filter(
    (e: Employee) => e.employeeType === 'contractor'
  );
  const selectedEmployee = form.employeeId ? employeesForBranchAndDepartment.find((e: Employee) => e._id === form.employeeId) : null;
  const effectiveDepartmentId =
    form.departmentId ||
    (selectedEmployee?.department && typeof selectedEmployee.department === 'object' && '_id' in selectedEmployee.department
      ? (selectedEmployee.department as { _id: string })._id
      : undefined);
  const { rates: rawRates } = useRates(false, form.branchId || undefined, effectiveDepartmentId);
  const rates = React.useMemo(() => {
    if (!form.branchId || !effectiveDepartmentId) return [];
    return (rawRates || []).filter((r: any) => {
      // Show only those that have THIS department and branch for them in the rate master
      return r.branchDepartmentRates?.some((bdr: any) => {
        const bid = bdr.branch && typeof bdr.branch === 'object' && '_id' in bdr.branch ? String(bdr.branch._id) : String(bdr.branch);
        const did = bdr.department && typeof bdr.department === 'object' && '_id' in bdr.department ? String(bdr.department._id) : String(bdr.department);
        return bid === form.branchId && did === effectiveDepartmentId;
      });
    });
  }, [rawRates, form.branchId, effectiveDepartmentId]);
  const { styleOrders: stylesForForm } = useStyleOrdersByBranchMonth(form.branchId || undefined, form.month || undefined, !!(form.branchId && form.month));
  const selectedStyle = stylesForForm?.find((s: { _id: string }) => s._id === form.styleOrderId) as StyleOrderWithAvailability | undefined;

  const getDefaultQuantity = (rateMasterId: string) => {
    const entry = selectedStyle?.monthData?.entries?.find((e: { rateMasterId: string }) => e.rateMasterId === rateMasterId);
    return entry?.availableQuantity ?? 0;
  };

  useEffect(() => {
    if (record && mode !== 'create') {
      const emp = record.employee as { _id?: string; name?: string };
      const br = record.branch as { _id?: string; name?: string };
      const style = record.styleOrder as { _id?: string; styleCode?: string } | undefined;
      const rec = record as { employee?: { department?: { _id?: string; name?: string } } };
      const empDept = rec.employee && typeof rec.employee === 'object' && (rec.employee as { department?: { _id?: string; name?: string } }).department;
      const workItemsRecord: Record<string, { quantity: number; defaultQuantity: number; ratePerUnit: number; defaultRatePerUnit: number; remarks: string }> = {};
      for (const wi of (record.workItems as Record<string, unknown>[]) || []) {
        const id = String(wi.rateMaster ?? (wi as { rateMasterId?: string }).rateMasterId ?? '');
        const qty = Math.max(1, (wi.quantity as number) || 1);
        const rate = Math.max(0, (wi.ratePerUnit as number) || 0);
        const defaultRate = Math.max(0, (wi.defaultRatePerUnit as number) ?? rate);
        if (id)
          workItemsRecord[id] = {
            quantity: qty,
            defaultQuantity: qty,
            ratePerUnit: rate,
            defaultRatePerUnit: defaultRate,
            remarks: (wi.remarks as string) ?? '',
          };
      }
      setForm({
        employeeId: emp?._id || String(record.employee) || '',
        employeeName: typeof emp === 'object' && emp?.name ? emp.name : '',
        branchId: br?._id || String(record.branch) || '',
        branchName: typeof br === 'object' && br?.name ? br.name : '',
        departmentId: empDept && typeof empDept === 'object' ? (empDept as { _id?: string })._id || '' : '',
        departmentName: empDept && typeof empDept === 'object' ? (empDept as { name?: string }).name || '' : '',
        month: (record.month as string) || '',
        styleOrderId: style?._id || '',
        styleOrderCode: formatStyleOrderDisplay((style as { styleCode?: string })?.styleCode, (style as { brand?: string })?.brand, (style as { colour?: string })?.colour || (record.colour as string)),
        colour: (record.colour as string) || '',
        workItems: workItemsRecord,
        otHours: (record.otHours as number) ?? 0,
        otAmount: (record.otAmount as number) ?? 0,
        notes: '',
      });
    }
  }, [record, mode]);

  useEffect(() => {
    if (mode !== 'create' || form.branchId) return;
    const branchList = Array.isArray(branches) ? branches : [];
    if (branchList.length === 1) {
      const onlyBranch = branchList[0] as { _id: string; name: string };
      setForm((f) => ({
        ...f,
        branchId: onlyBranch._id,
        branchName: onlyBranch.name,
      }));
    }
  }, [mode, branches, form.branchId]);

  const toggleRateChecked = (rateMasterId: string, checked: boolean) => {
    if (!rates?.length || !form.branchId || !effectiveDepartmentId) return;
    const rate = rates.find((r: RateMaster) => r._id === rateMasterId);
    if (!rate) return;
    if (checked) {
      const defaultQty = Math.max(1, getDefaultQuantity(rateMasterId));
      setForm((f) => ({
        ...f,
        workItems: {
          ...f.workItems,
          [rateMasterId]: {
            quantity: defaultQty,
            defaultQuantity: defaultQty,
            ratePerUnit: Math.max(0, rate.amountForBranch ?? 0),
            defaultRatePerUnit: Math.max(0, rate.amountForBranch ?? 0),
            remarks: '',
          },
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

  const selectAllRates = (checked: boolean) => {
    if (!rates?.length || !form.branchId || !effectiveDepartmentId) return;
    if (checked) {
      const next: Record<string, { quantity: number; defaultQuantity: number; ratePerUnit: number; defaultRatePerUnit: number; remarks: string }> = {};
      for (const r of rates as RateMaster[]) {
        const defaultQty = Math.max(1, getDefaultQuantity(r._id));
        next[r._id] = {
          quantity: defaultQty,
          defaultQuantity: defaultQty,
          ratePerUnit: Math.max(0, r.amountForBranch ?? 0),
          defaultRatePerUnit: Math.max(0, r.amountForBranch ?? 0),
          remarks: '',
        };
      }
      setForm((f) => ({ ...f, workItems: next }));
    } else {
      setForm((f) => ({ ...f, workItems: {} }));
    }
  };

  const updateWorkItemField = (rateMasterId: string, field: 'quantity' | 'ratePerUnit' | 'remarks', value: number | string) => {
    setForm((f) => {
      const item = f.workItems[rateMasterId];
      if (!item) return f;
      const next = { ...f.workItems };
      if (field === 'quantity') {
        const maxAllowed = getDefaultQuantity(rateMasterId);
        const raw = Math.max(1, Number(value) || 1);
        const capped = typeof maxAllowed === 'number' && maxAllowed >= 0 ? Math.min(raw, maxAllowed) : raw;
        next[rateMasterId] = { ...item, quantity: capped };
      } else if (field === 'ratePerUnit') next[rateMasterId] = { ...item, ratePerUnit: Math.max(0, Number(value) || 0) };
      else next[rateMasterId] = { ...item, remarks: String(value ?? '') };
      return { ...f, workItems: next };
    });
  };

  const hasUnapprovedRateOverride = (record?.workItems as { rateOverrideApproved?: boolean }[] | undefined)?.some?.((wi) => wi.rateOverrideApproved === false) ?? false;
  const isAdmin = user?.role === 'admin';
  const workTotal = Object.entries(form.workItems).reduce((sum, [, wi]) => sum + (wi.quantity || 0) * (wi.ratePerUnit || 0), 0);
  const totalAmount = workTotal + (form.otAmount ?? 0);

  const handleApproveRateOverride = async () => {
    if (!record?._id) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/work-records/${record._id}/approve-rate-override`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('rateOverrideApproved'));
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setApproving(false);
    }
  };

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
        colour: form.colour || undefined,
        workItems: workItemsArray,
        otHours: form.otHours ?? 0,
        otAmount: form.otAmount ?? 0,
        notes: form.notes,
      };

      if (mode === 'create') {
        const res = await fetch('/api/work-records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        toast.success(t('saveSuccess'));
        onSaved();
      } else if (record?._id) {
        const res = await fetch(`/api/work-records/${record._id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        toast.success(t('saveSuccess'));
        onSaved();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('error'));
    } finally {
      setSaving(false);
    }
  };

  const allRatesSelected = rates && rates.length > 0 && (rates as RateMaster[]).every((r) => !!form.workItems[r._id]);

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('branches')} *</label>
            {mode === 'view' ? (
              <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-800">{form.branchName || '–'}</p>
            ) : (
              <SearchableSelect
                label={t('branches')}
                options={[{ _id: '', name: 'Select branch first...' }, ...(Array.isArray(branches) ? branches : [])]}
                value={form.branchId}
                onChange={(val: string) => {
                  const b = (Array.isArray(branches) ? branches : []).find((x: { _id: string; name: string }) => x._id === val);
                  setForm((f) => ({
                    ...f,
                    branchId: val,
                    branchName: b?.name || '',
                    departmentId: '',
                    departmentName: '',
                    employeeId: '',
                    employeeName: '',
                    styleOrderId: '',
                    styleOrderCode: '',
                    colour: '',
                    workItems: {},
                  }));
                }}
                required
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('department')}</label>
            {mode === 'view' ? (
              <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-800">{form.departmentName || '–'}</p>
            ) : (
              <SearchableSelect
                label={t('department')}
                options={[{ _id: '', name: !form.branchId ? 'Select branch first' : 'Select department...' }, ...(Array.isArray(departments) ? departments : [])]}
                value={form.departmentId}
                onChange={(val: string) => {
                  const d = (Array.isArray(departments) ? departments : []).find((x: { _id: string; name: string }) => x._id === val);
                  setForm((f) => ({
                    ...f,
                    departmentId: val,
                    departmentName: d?.name || '',
                    employeeId: '',
                    employeeName: '',
                    styleOrderId: '',
                    styleOrderCode: '',
                    workItems: {},
                  }));
                }}
                disabled={!form.branchId}
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('employeeName')} *</label>
            {mode === 'view' ? (
              <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-800">{form.employeeName || '–'}</p>
            ) : (
              <SearchableSelect
                label={t('employeeName')}
                options={employeesForBranchAndDepartment}
                value={form.employeeId}
                onChange={(val: string) => {
                  const emp = employeesForBranchAndDepartment.find((x: Employee) => x._id === val);
                  setForm((f) => ({ ...f, employeeId: val, employeeName: emp?.name || '' }));
                }}
                placeholder={employeesForBranchAndDepartment.length === 0 && form.branchId
                  ? form.departmentId
                    ? 'No contractors in this branch & department'
                    : 'Select department first'
                  : 'Select employee...'}
                required
              />
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('month')} *</label>
            <input
              type="month"
              value={form.month}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  month: e.target.value,
                  styleOrderId: '',
                  styleOrderCode: '',
                  colour: '',
                  workItems: {},
                }))
              }
              readOnly={mode === 'view'}
              className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${mode === 'view' ? 'bg-slate-50 cursor-default' : ''}`}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('styleOrder')} *</label>
            {mode === 'view' ? (
              <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-800">{form.styleOrderCode || '–'}</p>
            ) : (
              <SearchableSelect
                label={t('styleOrder')}
                options={(Array.isArray(stylesForForm) ? stylesForForm : []).map((s: { _id: string; styleCode?: string; brand?: string; colour?: string }) => ({
                  _id: s._id,
                  name: formatStyleOrderDisplay(s.styleCode, s.brand, s.colour) || s._id
                }))}
                value={form.styleOrderId}
                onChange={(val: string) => {
                  const s = (Array.isArray(stylesForForm) ? stylesForForm : []).find((x: { _id: string }) => x._id === val);
                  const display = s ? formatStyleOrderDisplay((s as { styleCode?: string }).styleCode, (s as { brand?: string }).brand, (s as { colour?: string }).colour) : '';
                  const styleColour = (s as { colour?: string })?.colour ?? (Array.isArray((s as { colours?: string[] })?.colours) ? (s as { colours?: string[] }).colours?.[0] : '') ?? '';
                  setForm((f) => ({ ...f, styleOrderId: val, styleOrderCode: display, colour: styleColour, workItems: {} }));
                }}
                disabled={!form.branchId || !form.month}
                placeholder={!form.branchId || !form.month
                  ? 'Select branch & month first'
                  : stylesForForm?.length === 0
                    ? 'No styles for this branch/month'
                    : 'Select style/order...'}
                required
              />
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 mb-2">{t('workItems')} *</label>
          {form.branchId && effectiveDepartmentId && rates && rates.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <div className="min-w-0">
                {mode !== 'view' && (
                  <div className="px-3 py-2 border-b border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={allRatesSelected}
                        onChange={(e) => selectAllRates(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300"
                      />
                      <span className="font-medium text-slate-800">{t('selectAll')}</span>
                    </label>
                  </div>
                )}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {(mode === 'view' ? (rates as RateMaster[]).filter((r) => form.workItems[r._id]) : (rates as RateMaster[])).map((r) => {
                    const wi = form.workItems[r._id];
                    const isChecked = !!wi;
                    const maxQty = getDefaultQuantity(r._id);
                    const defaultRate = wi?.defaultRatePerUnit ?? r.amountForBranch ?? 0;
                    const defaultAmt = (maxQty || 0) * defaultRate;
                    const enteredAmt = isChecked ? (wi.quantity || 0) * (wi.ratePerUnit || 0) : 0;
                    const showRemarks = isChecked && wi.ratePerUnit !== wi.defaultRatePerUnit;
                    const recWi = (record?.workItems as { rateMaster?: string | { _id?: string }; rateOverrideApproved?: boolean }[] | undefined)?.find(
                      (x) => String(typeof x.rateMaster === 'object' && x.rateMaster?._id ? x.rateMaster._id : x.rateMaster ?? '') === r._id
                    );
                    const isOverridePending = recWi?.rateOverrideApproved === false;
                    return (
                      <div
                        key={r._id}
                        className={`p-3 text-sm ${isChecked ? 'bg-uff-surface/50' : 'bg-white'} ${isOverridePending ? 'border-l-4 border-l-amber-400' : ''}`}
                      >
                        <div className="flex flex-wrap items-start gap-4">
                          {mode !== 'view' && (
                            <label className="flex items-center gap-2 shrink-0 cursor-pointer pt-0.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => toggleRateChecked(r._id, e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300"
                              />
                            </label>
                          )}
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                              <span className="font-medium text-slate-800">{r.name} ({r.unit})</span>
                              <div className="flex flex-wrap gap-4 text-slate-600">
                                <span><span className="text-slate-500 text-xs">{t('maxQty')}:</span> <span className="tabular-nums font-medium">{maxQty}</span></span>
                                <span><span className="text-slate-500 text-xs">{t('defaultRate')}:</span> <span className="tabular-nums font-medium">₹{formatAmount(defaultRate)}</span></span>
                                <span><span className="text-slate-500 text-xs">{t('defaultAmount')}:</span> <span className="tabular-nums font-medium">₹{formatAmount(defaultAmt)}</span></span>
                              </div>
                            </div>
                            {(isChecked || mode === 'view') && (
                              <div className="flex flex-wrap gap-4 items-center">
                                <div>
                                  <span className="block text-xs text-slate-500 mb-0.5">{t('enteredQty')}</span>
                                  {mode === 'view' ? (
                                    <span className="tabular-nums">{wi.quantity}</span>
                                  ) : (
                                    <input
                                      type="number"
                                      min={1}
                                      max={maxQty}
                                      value={wi.quantity || ''}
                                      onChange={(e) => updateWorkItemField(r._id, 'quantity', parseFloat(e.target.value) || 1)}
                                      className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm text-right"
                                    />
                                  )}
                                </div>
                                <div>
                                  <span className="block text-xs text-slate-500 mb-0.5">{t('enteredRate')}</span>
                                  {mode === 'view' ? (
                                    <span className="tabular-nums">₹{wi.ratePerUnit}{isOverridePending && <span className="text-amber-600 text-xs ml-1">(pending)</span>}</span>
                                  ) : (
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={wi.ratePerUnit ?? ''}
                                      onChange={(e) => updateWorkItemField(r._id, 'ratePerUnit', parseFloat(e.target.value) ?? 0)}
                                      className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm text-right"
                                    />
                                  )}
                                </div>
                                <div>
                                  <span className="block text-xs text-slate-500 mb-0.5">{t('enteredAmount')}</span>
                                  <span className="tabular-nums font-medium">₹{formatAmount(enteredAmt)}</span>
                                </div>
                                {(showRemarks || mode === 'view') && (
                                  <div className="flex-1 min-w-[140px]">
                                    <span className="block text-xs text-slate-500 mb-0.5">{t('remarks')}</span>
                                    {mode === 'view' ? (
                                      <span className="text-slate-700">{showRemarks ? (wi.remarks || '–') : '–'}</span>
                                    ) : showRemarks ? (
                                      <input
                                        type="text"
                                        value={wi.remarks ?? ''}
                                        onChange={(e) => updateWorkItemField(r._id, 'remarks', e.target.value)}
                                        placeholder={t('remarksRequiredWhenRateChanged')}
                                        className="w-full px-2 py-1.5 border border-amber-300 rounded text-sm"
                                        required
                                      />
                                    ) : (
                                      <span className="text-slate-400 text-xs">–</span>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {hasUnapprovedRateOverride && mode === 'view' && (
                <p className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-t border-amber-200">
                  {t('rateOverridePending')}
                </p>
              )}
            </div>
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
              readOnly={mode === 'view'}
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
              readOnly={mode === 'view'}
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

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-200">
        {mode !== 'view' && (
          <button
            onClick={handleSave}
            disabled={
              saving ||
              !form.employeeId ||
              !form.branchId ||
              !form.month ||
              !form.styleOrderId ||
              Object.entries(form.workItems).filter(([, wi]) => (wi.quantity || 0) >= 1).length === 0
            }
            className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition"
          >
            {saving ? '...' : t('save')}
          </button>
        )}
        {mode === 'view' && hasUnapprovedRateOverride && isAdmin && (
          <button
            onClick={handleApproveRateOverride}
            disabled={approving}
            className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 transition"
          >
            {approving ? '...' : t('approveRateOverride')}
          </button>
        )}
        {mode === 'view' && canAdd && onSwitchToEdit && (
          <button
            onClick={onSwitchToEdit}
            className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium transition"
          >
            {t('edit')}
          </button>
        )}
        <button onClick={onClose} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition">
          {mode === 'view' ? t('close') : t('cancel')}
        </button>
      </div>

      <SaveOverlay show={saving || approving} label={saving ? t('saving') : t('approving')} />
    </>
  );
}
