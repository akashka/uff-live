'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import ValidatedInput from '@/components/ValidatedInput';
import { useBranches, useDepartments, useEmployees, useRates, useStyleOrdersByBranchMonth } from '@/lib/hooks/useApi';
import { formatAmount } from '@/lib/utils';
import { toast } from '@/lib/toast';
import SaveOverlay from '@/components/SaveOverlay';

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

  const { branches } = useBranches(false);
  const { departments } = useDepartments(true);
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
  const { rates } = useRates(true, form.branchId || undefined, effectiveDepartmentId);
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
        if (id)
          workItemsRecord[id] = {
            quantity: qty,
            defaultQuantity: qty,
            ratePerUnit: rate,
            defaultRatePerUnit: rate,
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
        styleOrderCode: (style as { brand?: string })?.brand ? `${(style as { styleCode?: string })?.styleCode || ''} - ${(style as { brand?: string })?.brand}` : style?.styleCode || '',
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

  const workTotal = Object.entries(form.workItems).reduce((sum, [, wi]) => sum + (wi.quantity || 0) * (wi.ratePerUnit || 0), 0);
  const totalAmount = workTotal + (form.otAmount ?? 0);

  const handleSave = async () => {
    setSaving(true);
    try {
      const workItemsArray = Object.entries(form.workItems)
        .filter(([, wi]) => (wi.quantity || 0) > 0)
        .map(([rateMasterId, wi]) => {
          const needsRemarks = wi.ratePerUnit !== wi.defaultRatePerUnit || wi.quantity !== wi.defaultQuantity;
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
              <select
                value={form.branchId}
                onChange={(e) => {
                  const b = (Array.isArray(branches) ? branches : []).find((x: { _id: string; name: string }) => x._id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    branchId: e.target.value,
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
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              >
                <option value="">Select branch first...</option>
                {(Array.isArray(branches) ? branches : []).map((b: { _id: string; name: string }) => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('department')}</label>
            {mode === 'view' ? (
              <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-800">{form.departmentName || '–'}</p>
            ) : (
              <select
                value={form.departmentId}
                onChange={(e) => {
                  const d = (Array.isArray(departments) ? departments : []).find((x: { _id: string; name: string }) => x._id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    departmentId: e.target.value,
                    departmentName: d?.name || '',
                    employeeId: '',
                    employeeName: '',
                    styleOrderId: '',
                    styleOrderCode: '',
                    workItems: {},
                  }));
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
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('employeeName')} *</label>
            {mode === 'view' ? (
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
                <option value="">
                  {employeesForBranchAndDepartment.length === 0 && form.branchId
                    ? form.departmentId
                      ? 'No contractors in this branch & department'
                      : 'Select department first'
                    : 'Select employee...'}
                </option>
                {employeesForBranchAndDepartment.map((e: Employee) => (
                  <option key={e._id} value={e._id}>{e.name}</option>
                ))}
              </select>
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
              <select
                value={form.styleOrderId}
                onChange={(e) => {
                  const s = (Array.isArray(stylesForForm) ? stylesForForm : []).find((x: { _id: string }) => x._id === e.target.value);
                  const display = s ? ((s as { brand?: string }).brand ? `${(s as { styleCode?: string }).styleCode || ''} - ${(s as { brand?: string }).brand}` : (s as { styleCode?: string }).styleCode || '') : '';
                  const styleColour = (s as { colour?: string })?.colour ?? (Array.isArray((s as { colours?: string[] })?.colours) ? (s as { colours?: string[] }).colours?.[0] : '') ?? '';
                  setForm((f) => ({ ...f, styleOrderId: e.target.value, styleOrderCode: display, colour: styleColour, workItems: {} }));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                disabled={!form.branchId || !form.month}
              >
                <option value="">
                  {!form.branchId || !form.month
                    ? 'Select branch & month first'
                    : stylesForForm?.length === 0
                      ? 'No styles for this branch/month'
                      : 'Select style/order...'}
                </option>
                {(Array.isArray(stylesForForm) ? stylesForForm : []).map((s: { _id: string; styleCode?: string; brand?: string }) => (
                  <option key={s._id} value={s._id}>
                    {(s as { brand?: string }).brand ? `${(s as { styleCode?: string }).styleCode || ''} - ${(s as { brand?: string }).brand}` : (s as { styleCode?: string }).styleCode || s._id}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 mb-2">{t('workItems')} *</label>
          {form.branchId && effectiveDepartmentId && rates && rates.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_80px_100px_80px_1fr] gap-2 px-3 py-2 bg-uff-surface text-sm font-medium text-slate-800 border-b border-slate-200">
                {mode !== 'view' ? (
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allRatesSelected}
                      onChange={(e) => selectAllRates(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                    <span className="text-xs">{t('selectAll')}</span>
                  </label>
                ) : (
                  <span className="w-8" />
                )}
                <span>{t('rateName') || 'Rate'}</span>
                <span>{t('quantityShort') || 'Qty'}</span>
                <span>{t('rate') || 'Rate (₹)'}</span>
                <span>{t('amount') || 'Amount'}</span>
                <span>{t('remarks')}</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {(mode === 'view' ? (rates as RateMaster[]).filter((r) => form.workItems[r._id]) : (rates as RateMaster[])).map((r) => {
                  const wi = form.workItems[r._id];
                  const isChecked = !!wi;
                  const maxQty = getDefaultQuantity(r._id);
                  const amount = isChecked ? (wi.quantity || 0) * (wi.ratePerUnit || 0) : 0;
                  const defaultAmount = isChecked ? (wi.defaultQuantity || 0) * (wi.defaultRatePerUnit || 0) : 0;
                  const showRemarks = isChecked && (wi.ratePerUnit !== wi.defaultRatePerUnit || wi.quantity !== wi.defaultQuantity);
                  return (
                    <div
                      key={r._id}
                      className={`grid grid-cols-[auto_1fr_80px_100px_80px_1fr] gap-2 px-3 py-2 items-center border-b border-slate-100 last:border-0 text-sm ${isChecked ? 'bg-uff-surface/50' : ''}`}
                    >
                      {mode === 'view' ? (
                        <>
                          <span className="w-8" />
                          <span className="text-slate-800">{r.name} ({r.unit})</span>
                          <span>{wi.quantity} / {maxQty}</span>
                          <span>₹{wi.ratePerUnit} {wi.ratePerUnit !== wi.defaultRatePerUnit && <span className="text-amber-600">(was ₹{wi.defaultRatePerUnit})</span>}</span>
                          <span>₹{formatAmount(amount)}</span>
                          <span>{wi.remarks || '–'}</span>
                        </>
                      ) : (
                        <>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => toggleRateChecked(r._id, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300"
                          />
                          <span className="text-slate-800">{r.name} ({r.unit}) {maxQty > 0 && <span className="text-slate-500 text-xs">(max {maxQty})</span>}</span>
                          {isChecked ? (
                            <>
                              <input
                                type="number"
                                min={1}
                                max={maxQty}
                                value={wi.quantity || ''}
                                onChange={(e) => updateWorkItemField(r._id, 'quantity', parseFloat(e.target.value) || 1)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                              />
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={wi.ratePerUnit ?? ''}
                                onChange={(e) => updateWorkItemField(r._id, 'ratePerUnit', parseFloat(e.target.value) ?? 0)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                              />
                              <span className="text-slate-700">₹{formatAmount(amount)}</span>
                              {showRemarks ? (
                                <input
                                  type="text"
                                  value={wi.remarks ?? ''}
                                  onChange={(e) => updateWorkItemField(r._id, 'remarks', e.target.value)}
                                  placeholder={t('remarksRequiredWhenRateChanged')}
                                  className="w-full px-2 py-1 border border-slate-300 rounded text-sm border-amber-300"
                                  required
                                />
                              ) : (
                                <span className="text-slate-400 text-xs">–</span>
                              )}
                            </>
                          ) : (
                            <>
                              <span className="text-slate-400">–</span>
                              <span className="text-slate-400">₹{r.amountForBranch ?? 0}</span>
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

      <SaveOverlay show={saving} label={t('saving')} />
    </>
  );
}
