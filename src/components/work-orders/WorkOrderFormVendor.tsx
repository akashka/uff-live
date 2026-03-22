'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import ValidatedInput from '@/components/ValidatedInput';
import { useVendors, useStyleOrdersByBranchMonth } from '@/lib/hooks/useApi';
import { formatAmount, formatStyleOrderDisplay } from '@/lib/utils';
import { toast } from '@/lib/toast';
import SaveOverlay from '@/components/SaveOverlay';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

interface WorkOrderFormVendorProps {
  mode: 'create' | 'edit' | 'view';
  record?: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}

interface Vendor {
  _id: string;
  name: string;
  isActive?: boolean;
}

interface StyleOrderWithAvailability {
  _id: string;
  styleCode: string;
  monthData?: {
    entries: { rateMasterId: string; rateName?: string; unit?: string; totalOrderQuantity: number; availableQuantity: number }[];
  } | null;
}

export default function WorkOrderFormVendor({ mode, record, onClose, onSaved }: WorkOrderFormVendorProps) {
  const { t } = useApp();
  const { user } = useAuth();
  const canAdd = ['admin', 'finance', 'hr'].includes(user?.role || '');
  const isAdmin = user?.role === 'admin';
  const hasUnapprovedRateOverride = (record?.workItems as { rateOverrideApproved?: boolean }[] | undefined)?.some?.((wi) => wi.rateOverrideApproved === false) ?? false;

  const [form, setForm] = useState({
    vendorId: '',
    vendorName: '',
    month: getCurrentMonth(),
    styleOrderId: '',
    styleOrderCode: '',
    colour: '',
    workItems: {} as Record<string, { quantity: number; defaultQuantity: number; ratePerUnit: number; defaultRatePerUnit: number; remarks: string }>,
    extraAmount: 0,
    reasons: '',
  });

  const [saving, setSaving] = useState(false);
  const [approving, setApproving] = useState(false);

  const { vendors: vendorList } = useVendors(false, { limit: 0 });
  const vendors = (Array.isArray(vendorList) ? vendorList : []).filter((v: Vendor) => v.isActive !== false);
  // No branch for vendor - pass undefined to get styles for month only
  const { styleOrders: stylesForForm } = useStyleOrdersByBranchMonth(undefined, form.month || undefined, !!(form.month));
  const selectedStyle = stylesForForm?.find((s: { _id: string }) => s._id === form.styleOrderId) as StyleOrderWithAvailability | undefined;

  const getAvailableQuantity = (rateMasterId: string) => {
    const entry = selectedStyle?.monthData?.entries?.find((e: { rateMasterId: string }) => e.rateMasterId === rateMasterId);
    return entry?.availableQuantity ?? 0;
  };

  useEffect(() => {
    if (record && mode !== 'create') {
      const ven = record.vendor as { _id?: string; name?: string };
      const style = record.styleOrder as { _id?: string; styleCode?: string } | undefined;
      const workItemsRecord: Record<string, { quantity: number; defaultQuantity: number; ratePerUnit: number; defaultRatePerUnit: number; remarks: string }> = {};
      for (const wi of (record.workItems as Record<string, unknown>[]) || []) {
        const id = String((wi as { workItemKey?: string }).workItemKey ?? wi.rateMaster ?? (wi as { rateMasterId?: string }).rateMasterId ?? '');
        const qty = Math.max(1, (wi.quantity as number) || 1);
        const rate = Math.max(0, (wi.ratePerUnit as number) || 0);
        const defaultRate = Math.max(0, (wi.defaultRatePerUnit as number) ?? rate);
        if (id) workItemsRecord[id] = { quantity: qty, defaultQuantity: qty, ratePerUnit: rate, defaultRatePerUnit: defaultRate, remarks: (wi.remarks as string) ?? '' };
      }
      setForm({
        vendorId: ven?._id || String(record.vendor) || '',
        vendorName: typeof ven === 'object' && ven?.name ? ven.name : '',
        month: (record.month as string) || '',
        styleOrderId: style?._id || '',
        styleOrderCode: formatStyleOrderDisplay((style as { styleCode?: string })?.styleCode, (style as { brand?: string })?.brand, (style as { colour?: string })?.colour || (record.colour as string)),
        colour: (record.colour as string) || '',
        workItems: workItemsRecord,
        extraAmount: (record.extraAmount as number) ?? 0,
        reasons: (record.reasons as string) ?? '',
      });
    }
  }, [record, mode]);

  // Get rate masters from selected style's monthData entries
  const rateItems = selectedStyle?.monthData?.entries ?? [];
  const allRateIds = rateItems.map((e: { rateMasterId: string }) => e.rateMasterId);

  const toggleWorkItem = (rateMasterId: string, checked: boolean) => {
    if (checked) {
      const available = getAvailableQuantity(rateMasterId);
      setForm((f) => ({
        ...f,
        workItems: {
          ...f.workItems,
          [rateMasterId]: { quantity: Math.max(1, available), defaultQuantity: available, ratePerUnit: 0, defaultRatePerUnit: 0, remarks: '' },
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

  const selectAllWorkItems = (checked: boolean) => {
    if (checked) {
      const next: Record<string, { quantity: number; defaultQuantity: number; ratePerUnit: number; defaultRatePerUnit: number; remarks: string }> = {};
      for (const e of rateItems as { rateMasterId: string }[]) {
        const available = getAvailableQuantity(e.rateMasterId);
        next[e.rateMasterId] = { quantity: Math.max(1, available), defaultQuantity: available, ratePerUnit: 0, defaultRatePerUnit: 0, remarks: '' };
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
        const maxAllowed = getAvailableQuantity(rateMasterId);
        const raw = Math.max(1, Number(value) || 1);
        const capped = typeof maxAllowed === 'number' && maxAllowed >= 0 ? Math.min(raw, maxAllowed) : raw;
        next[rateMasterId] = { ...item, quantity: capped };
      } else if (field === 'ratePerUnit') next[rateMasterId] = { ...item, ratePerUnit: Math.max(0, Number(value) || 0) };
      else next[rateMasterId] = { ...item, remarks: String(value ?? '') };
      return { ...f, workItems: next };
    });
  };

  const workTotal = Object.entries(form.workItems).reduce((sum, [, wi]) => sum + (wi.quantity || 0) * (wi.ratePerUnit || 0), 0);
  const totalAmount = workTotal + (form.extraAmount ?? 0);

  const handleSave = async () => {
    const entries = Object.entries(form.workItems).filter(([, wi]) => (wi.quantity || 0) >= 1);
    const missingRate = entries.some(([, wi]) => (wi.ratePerUnit ?? 0) <= 0);
    if (missingRate) {
      toast.error(t('enterRateForWorkItems') || 'Please enter rate (₹) for all selected work items.');
      return;
    }
    const rateChangedNeedsRemarks = entries.some(([, wi]) => wi.ratePerUnit !== wi.defaultRatePerUnit && !(wi.remarks || '').trim());
    if (rateChangedNeedsRemarks) {
      toast.error(t('remarksRequiredWhenRateChanged'));
      return;
    }

    setSaving(true);
    try {
      const workItemsArray = entries.map(([rateMasterId, wi]) => ({
        rateMasterId,
        quantity: wi.quantity,
        multiplier: 1,
        remarks: wi.remarks ?? '',
        ratePerUnit: wi.ratePerUnit,
      }));

      const payload = {
        vendorId: form.vendorId,
        month: form.month,
        styleOrderId: form.styleOrderId,
        colour: form.colour || undefined,
        workItems: workItemsArray,
        extraAmount: form.extraAmount ?? 0,
        reasons: form.reasons ?? '',
      };

      if (mode === 'create') {
        const res = await fetch('/api/vendor-work-orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        toast.success(t('saveSuccess'));
        onSaved();
      } else if (record?._id) {
        const res = await fetch(`/api/vendor-work-orders/${record._id}`, {
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

  const allSelected = rateItems.length > 0 && rateItems.every((e: { rateMasterId: string }) => !!form.workItems[e.rateMasterId]);

  const handleApproveRateOverride = async () => {
    if (!record?._id) return;
    setApproving(true);
    try {
      const res = await fetch(`/api/vendor-work-orders/${record._id}/approve-rate-override`, { method: 'POST' });
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

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('vendor')} *</label>
            {mode === 'view' ? (
              <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-800">{form.vendorName || '–'}</p>
            ) : (
              <select
                value={form.vendorId}
                onChange={(e) => {
                  const ven = vendors.find((x: Vendor) => x._id === e.target.value);
                  setForm((f) => ({ ...f, vendorId: e.target.value, vendorName: ven?.name || '' }));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
                disabled={mode === 'edit'}
              >
                <option value="">Select vendor...</option>
                {vendors.map((v: Vendor) => (
                  <option key={v._id} value={v._id}>{v.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('month')} *</label>
            <input
              type="month"
              value={form.month}
              onChange={(e) => setForm((f) => ({ ...f, month: e.target.value, styleOrderId: '', styleOrderCode: '', workItems: {} }))}
              readOnly={mode === 'view'}
              className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${mode === 'view' ? 'bg-slate-50 cursor-default' : ''}`}
              required
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('styleOrder')} *</label>
            {mode === 'view' ? (
              <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-800">{form.styleOrderCode || '–'}</p>
            ) : (
              <select
                value={form.styleOrderId}
                onChange={(e) => {
                  const s = (Array.isArray(stylesForForm) ? stylesForForm : []).find((x: { _id: string }) => x._id === e.target.value);
                  const display = s ? formatStyleOrderDisplay((s as { styleCode?: string }).styleCode, (s as { brand?: string }).brand, (s as { colour?: string }).colour) : '';
                  const styleColour = (s as { colour?: string })?.colour ?? (Array.isArray((s as { colours?: string[] })?.colours) ? (s as { colours?: string[] }).colours?.[0] : '') ?? '';
                  setForm((f) => ({ ...f, styleOrderId: e.target.value, styleOrderCode: display, colour: styleColour, workItems: {} }));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                disabled={!form.month}
              >
                <option value="">{!form.month ? 'Select month first' : stylesForForm?.length === 0 ? 'No styles for this month' : 'Select style/order...'}</option>
                {(Array.isArray(stylesForForm) ? stylesForForm : []).map((s: { _id: string; styleCode?: string; brand?: string; colour?: string }) => (
                  <option key={s._id} value={s._id}>
                    {formatStyleOrderDisplay(s.styleCode, s.brand, s.colour) || s._id}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-800 mb-2">{t('workItems')} *</label>
          <p className="text-xs text-slate-600 mb-2">Max qty and default rate shown (read-only). Enter quantity and rate. Remarks required when rate differs from default.</p>
          {form.styleOrderId && rateItems.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <div className="min-w-0">
                {mode !== 'view' && (
                  <div className="px-3 py-2 border-b border-slate-200">
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                      <input type="checkbox" checked={allSelected} onChange={(e) => selectAllWorkItems(e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
                      <span className="font-medium text-slate-800">{t('selectAll')}</span>
                    </label>
                  </div>
                )}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {rateItems.map((entry: { rateMasterId: string; rateName?: string; unit?: string; totalOrderQuantity: number; availableQuantity: number }) => {
                    const wi = form.workItems[entry.rateMasterId];
                    const isChecked = !!wi;
                    const maxQty = entry.availableQuantity;
                    const defaultRate = wi?.defaultRatePerUnit ?? 0;
                    const defaultAmt = (maxQty || 0) * defaultRate;
                    const enteredAmt = isChecked ? (wi.quantity || 0) * (wi.ratePerUnit || 0) : 0;
                    const showRemarks = isChecked && wi.ratePerUnit !== wi.defaultRatePerUnit;
                    const recWi = (record?.workItems as { rateMaster?: string | { _id?: string }; rateOverrideApproved?: boolean }[] | undefined)?.find(
                      (x) => String(typeof x.rateMaster === 'object' && x.rateMaster?._id ? x.rateMaster._id : x.rateMaster ?? '') === entry.rateMasterId
                    );
                    const isOverridePending = recWi?.rateOverrideApproved === false;
                    const rateName = entry.rateName || `Rate ${entry.rateMasterId.slice(-4)}`;
                    const unit = entry.unit || 'per piece';
                    return (
                      <div key={entry.rateMasterId} className={`p-3 text-sm ${isChecked ? 'bg-uff-surface/50' : 'bg-white'} ${isOverridePending ? 'border-l-4 border-l-amber-400' : ''}`}>
                        <div className="flex flex-wrap items-start gap-4">
                          {mode !== 'view' && (
                            <label className="flex items-center gap-2 shrink-0 cursor-pointer pt-0.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => toggleWorkItem(entry.rateMasterId, e.target.checked)}
                                className="w-4 h-4 rounded border-slate-300"
                              />
                            </label>
                          )}
                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                              <span className="font-medium text-slate-800">{rateName} ({unit})</span>
                              <div className="flex flex-wrap gap-4 text-slate-600">
                                <span><span className="text-slate-500 text-xs">{t('maxQty')}:</span> <span className="tabular-nums font-medium">{maxQty}</span></span>
                                <span><span className="text-slate-500 text-xs">{t('defaultRate')}:</span> <span className="tabular-nums font-medium">₹{formatAmount(defaultRate)}</span></span>
                                <span><span className="text-slate-500 text-xs">{t('defaultAmount')}:</span> <span className="tabular-nums font-medium">₹{formatAmount(defaultAmt)}</span></span>
                              </div>
                            </div>
                            {(isChecked || (mode === 'view' && wi)) && (
                              <div className="flex flex-wrap gap-4 items-center">
                                <div>
                                  <span className="block text-xs text-slate-500 mb-0.5">{t('enteredQty')}</span>
                                  {mode === 'view' ? (
                                    <span className="tabular-nums">{wi?.quantity ?? '–'}</span>
                                  ) : (
                                    <input
                                      type="number"
                                      min={1}
                                      max={maxQty}
                                      value={wi?.quantity || ''}
                                      onChange={(e) => updateWorkItemField(entry.rateMasterId, 'quantity', parseFloat(e.target.value) || 1)}
                                      className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm text-right"
                                    />
                                  )}
                                </div>
                                <div>
                                  <span className="block text-xs text-slate-500 mb-0.5">{t('enteredRate')}</span>
                                  {mode === 'view' ? (
                                    <span className="tabular-nums">₹{wi?.ratePerUnit ?? '–'}{isOverridePending && <span className="text-amber-600 text-xs ml-1">(pending)</span>}</span>
                                  ) : (
                                    <input
                                      type="number"
                                      min={0}
                                      step={0.01}
                                      value={wi?.ratePerUnit ?? ''}
                                      onChange={(e) => updateWorkItemField(entry.rateMasterId, 'ratePerUnit', parseFloat(e.target.value) ?? 0)}
                                      className="w-24 px-2 py-1.5 border border-slate-300 rounded text-sm text-right"
                                    />
                                  )}
                                </div>
                                <div>
                                  <span className="block text-xs text-slate-500 mb-0.5">{t('enteredAmount')}</span>
                                  <span className="tabular-nums font-medium">₹{formatAmount(enteredAmt)}</span>
                                </div>
                                {(showRemarks || (mode === 'view' && wi)) && (
                                  <div className="flex-1 min-w-[140px]">
                                    <span className="block text-xs text-slate-500 mb-0.5">{t('remarks')}</span>
                                    {mode === 'view' ? (
                                      <span className="text-slate-700">{showRemarks ? (wi?.remarks || '–') : '–'}</span>
                                    ) : showRemarks ? (
                                      <input
                                        type="text"
                                        value={wi?.remarks ?? ''}
                                        onChange={(e) => updateWorkItemField(entry.rateMasterId, 'remarks', e.target.value)}
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
                {hasUnapprovedRateOverride && mode === 'view' && (
                  <p className="px-3 py-2 text-xs text-amber-700 bg-amber-50 border-t border-amber-200">
                    {t('rateOverridePending')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('extraAmount') || 'Extra Amount'} (₹)</label>
            <ValidatedInput
              type="text"
              inputMode="decimal"
              value={form.extraAmount != null && form.extraAmount !== 0 ? String(form.extraAmount) : ''}
              onChange={(v) => setForm((f) => ({ ...f, extraAmount: parseFloat(v) || 0 }))}
              fieldType="number"
              placeholderHint="0"
              readOnly={mode === 'view'}
              className="w-full px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('reasons') || 'Reasons'}</label>
            <input
              type="text"
              value={form.reasons}
              onChange={(e) => setForm((f) => ({ ...f, reasons: e.target.value }))}
              readOnly={mode === 'view'}
              placeholder={t('reasons') || 'Enter reasons for extra amount'}
              className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${mode === 'view' ? 'bg-slate-50 cursor-default' : ''}`}
            />
          </div>
        </div>

        <div className="flex justify-end font-semibold text-lg">
          {t('totalAmount')}: ₹{formatAmount(totalAmount)}
          {(form.extraAmount ?? 0) > 0 && (
            <span className="ml-2 text-sm font-normal text-slate-600">
              (work: ₹{formatAmount(workTotal)} + extra: ₹{formatAmount(form.extraAmount)})
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-200">
        {mode === 'view' && hasUnapprovedRateOverride && isAdmin && (
          <button
            onClick={handleApproveRateOverride}
            disabled={approving}
            className="px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-medium disabled:opacity-50 transition"
          >
            {approving ? '...' : t('approveRateOverride')}
          </button>
        )}
        {mode !== 'view' && (
          <button
            onClick={handleSave}
            disabled={
              saving ||
              !form.vendorId ||
              !form.month ||
              !form.styleOrderId ||
              Object.entries(form.workItems).filter(([, wi]) => (wi.quantity || 0) >= 1).length === 0
            }
            className="px-5 py-2.5 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50 transition"
          >
            {saving ? '...' : t('save')}
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
