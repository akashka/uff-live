'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import ValidatedInput from '@/components/ValidatedInput';
import { useVendors, useStyleOrdersByBranchMonth } from '@/lib/hooks/useApi';
import { formatAmount } from '@/lib/utils';
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

  const [form, setForm] = useState({
    vendorId: '',
    vendorName: '',
    month: getCurrentMonth(),
    styleOrderId: '',
    styleOrderCode: '',
    colour: '',
    workItems: {} as Record<string, { quantity: number; ratePerUnit: number; remarks: string }>,
    extraAmount: 0,
    reasons: '',
  });

  const [saving, setSaving] = useState(false);

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
      const workItemsRecord: Record<string, { quantity: number; ratePerUnit: number; remarks: string }> = {};
      for (const wi of (record.workItems as Record<string, unknown>[]) || []) {
        const id = String((wi as { workItemKey?: string }).workItemKey ?? wi.rateMaster ?? (wi as { rateMasterId?: string }).rateMasterId ?? '');
        const qty = Math.max(1, (wi.quantity as number) || 1);
        const rate = Math.max(0, (wi.ratePerUnit as number) || 0);
        if (id) workItemsRecord[id] = { quantity: qty, ratePerUnit: rate, remarks: (wi.remarks as string) ?? '' };
      }
      setForm({
        vendorId: ven?._id || String(record.vendor) || '',
        vendorName: typeof ven === 'object' && ven?.name ? ven.name : '',
        month: (record.month as string) || '',
        styleOrderId: style?._id || '',
        styleOrderCode: (style as { brand?: string })?.brand ? `${(style as { styleCode?: string })?.styleCode || ''} - ${(style as { brand?: string })?.brand}` : style?.styleCode || '',
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
          [rateMasterId]: { quantity: Math.max(1, available), ratePerUnit: 0, remarks: '' },
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
      const next: Record<string, { quantity: number; ratePerUnit: number; remarks: string }> = {};
      for (const e of rateItems as { rateMasterId: string }[]) {
        const available = getAvailableQuantity(e.rateMasterId);
        next[e.rateMasterId] = { quantity: Math.max(1, available), ratePerUnit: 0, remarks: '' };
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
                  const display = s ? ((s as { brand?: string }).brand ? `${(s as { styleCode?: string }).styleCode || ''} - ${(s as { brand?: string }).brand}` : (s as { styleCode?: string }).styleCode || '') : '';
                  const styleColour = (s as { colour?: string })?.colour ?? (Array.isArray((s as { colours?: string[] })?.colours) ? (s as { colours?: string[] }).colours?.[0] : '') ?? '';
                  setForm((f) => ({ ...f, styleOrderId: e.target.value, styleOrderCode: display, colour: styleColour, workItems: {} }));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                disabled={!form.month}
              >
                <option value="">{!form.month ? 'Select month first' : stylesForForm?.length === 0 ? 'No styles for this month' : 'Select style/order...'}</option>
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
          <p className="text-xs text-slate-600 mb-2">Quantity is autofilled (available from design). Enter rate and remarks for each.</p>
          {form.styleOrderId && rateItems.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[auto_1fr_80px_100px_80px_1fr] gap-2 px-3 py-2 bg-uff-surface text-sm font-medium text-slate-800 border-b border-slate-200">
                {mode !== 'view' ? (
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input type="checkbox" checked={allSelected} onChange={(e) => selectAllWorkItems(e.target.checked)} className="w-4 h-4 rounded border-slate-300" />
                    <span className="text-xs">{t('selectAll')}</span>
                  </label>
                ) : (
                  <span className="w-8" />
                )}
                <span>{t('rateName') || 'Work Item'}</span>
                <span>{t('quantityShort') || 'Qty'}</span>
                <span>{t('rate') || 'Rate (₹)'}</span>
                <span>{t('amount') || 'Amount'}</span>
                <span>{t('remarks')}</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {rateItems.map((entry: { rateMasterId: string; rateName?: string; unit?: string; totalOrderQuantity: number; availableQuantity: number }) => {
                  const wi = form.workItems[entry.rateMasterId];
                  const isChecked = !!wi;
                  const amount = isChecked ? (wi.quantity || 0) * (wi.ratePerUnit || 0) : 0;
                  const rateName = entry.rateName || `Rate ${entry.rateMasterId.slice(-4)}`;
                  const unit = entry.unit || 'per piece';
                  return (
                    <div key={entry.rateMasterId} className={`grid grid-cols-[auto_1fr_80px_100px_80px_1fr] gap-2 px-3 py-2 items-center border-b border-slate-100 last:border-0 text-sm ${isChecked ? 'bg-uff-surface/50' : ''}`}>
                      {mode === 'view' ? (
                        <>
                          <span className="w-8" />
                          <span>{rateName}</span>
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
                            onChange={(e) => toggleWorkItem(entry.rateMasterId, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300"
                          />
                          <span>{rateName} ({unit}) – avail: {entry.availableQuantity}</span>
                          {isChecked ? (
                            <>
                              <input
                                type="number"
                                min={1}
                                max={entry.availableQuantity}
                                value={wi.quantity || ''}
                                onChange={(e) => updateWorkItemField(entry.rateMasterId, 'quantity', parseFloat(e.target.value) || 1)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                              />
                              <input
                                type="number"
                                min={0}
                                step={0.01}
                                value={wi.ratePerUnit ?? ''}
                                onChange={(e) => updateWorkItemField(entry.rateMasterId, 'ratePerUnit', parseFloat(e.target.value) ?? 0)}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                              />
                              <span>₹{formatAmount(amount)}</span>
                              <input
                                type="text"
                                value={wi.remarks ?? ''}
                                onChange={(e) => updateWorkItemField(entry.rateMasterId, 'remarks', e.target.value)}
                                placeholder={t('remarks')}
                                className="w-full px-2 py-1 border border-slate-300 rounded text-sm"
                              />
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

      <SaveOverlay show={saving} label={t('saving')} />
    </>
  );
}
