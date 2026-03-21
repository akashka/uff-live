'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import { useBranches, useDepartments, useEmployees } from '@/lib/hooks/useApi';
import { formatAmount } from '@/lib/utils';
import { toast } from '@/lib/toast';
import SaveOverlay from '@/components/SaveOverlay';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getWorkingDaysInMonth(monthStr: string): number {
  const [y, m] = monthStr.split('-').map(Number);
  let workingDays = 0;
  const lastDay = new Date(y, m, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    const day = new Date(y, m - 1, d);
    if (day.getDay() !== 0) workingDays++;
  }
  return workingDays;
}

interface WorkOrderFormFullTimeProps {
  mode: 'create' | 'edit' | 'view';
  record?: Record<string, unknown> | null;
  onClose: () => void;
  onSaved: () => void;
}

interface Employee {
  _id: string;
  name: string;
  employeeType: string;
  branches: unknown[];
}

export default function WorkOrderFormFullTime({ mode, record, onClose, onSaved }: WorkOrderFormFullTimeProps) {
  const { t } = useApp();
  const { user } = useAuth();
  const canAdd = ['admin', 'finance', 'hr'].includes(user?.role || '');

  const [form, setForm] = useState({
    employeeId: '',
    employeeName: '',
    branchId: '',
    branchName: '',
    month: getCurrentMonth(),
    daysWorked: 0,
    otHours: 0,
    notes: '',
  });

  const [saving, setSaving] = useState(false);
  const [daysAlreadyUsed, setDaysAlreadyUsed] = useState(0);
  const [departmentId, setDepartmentId] = useState('');

  const workingDays = getWorkingDaysInMonth(form.month);
  const maxDaysAllowed = Math.max(0, workingDays - daysAlreadyUsed);

  const { branches } = useBranches(false);
  const { departments } = useDepartments(true);
  const { employees: formEmpList } = useEmployees(false, {
    limit: 0,
    branchId: form.branchId || undefined,
    departmentId: departmentId || undefined,
    employeeType: 'full_time',
  });
  const employeesForBranch = (Array.isArray(formEmpList) ? formEmpList : []).filter(
    (e: Employee) => e.employeeType === 'full_time'
  );

  useEffect(() => {
    if (record && mode !== 'create') {
      const emp = record.employee as { _id?: string; name?: string };
      const br = record.branch as { _id?: string; name?: string };
      setForm({
        employeeId: emp?._id || String(record.employee) || '',
        employeeName: typeof emp === 'object' && emp?.name ? emp.name : '',
        branchId: br?._id || String(record.branch) || '',
        branchName: typeof br === 'object' && br?.name ? br.name : '',
        month: (record.month as string) || '',
        daysWorked: (record.daysWorked as number) ?? 0,
        otHours: (record.otHours as number) ?? 0,
        notes: (record.notes as string) || '',
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

  useEffect(() => {
    if (!form.employeeId || !form.month || mode === 'create') return;
    const fetchUsed = async () => {
      try {
        const res = await fetch(
          `/api/full-time-work-records?employeeId=${form.employeeId}&month=${form.month}`
        );
        const data = await res.json();
        if (Array.isArray(data)) {
          const selfId = record?._id ? String(record._id) : '';
          const used = data
            .filter((r: { _id: string; daysWorked?: number }) => String(r._id) !== selfId)
            .reduce((s: number, r: { daysWorked?: number }) => s + (r.daysWorked ?? 0), 0);
          setDaysAlreadyUsed(used);
        }
      } catch {
        setDaysAlreadyUsed(0);
      }
    };
    fetchUsed();
  }, [form.employeeId, form.month, mode, record?._id]);

  const handleSave = async () => {
    if (form.daysWorked > maxDaysAllowed) {
      toast.error(
        t('maxDaysExceeded') || `Maximum ${maxDaysAllowed} days allowed (${daysAlreadyUsed} already entered for this month)`
      );
      return;
    }
    setSaving(true);
    try {
      const payload = {
        employeeId: form.employeeId,
        branchId: form.branchId,
        month: form.month,
        daysWorked: form.daysWorked,
        otHours: form.otHours,
        notes: form.notes,
      };

      if (mode === 'create') {
        const res = await fetch('/api/full-time-work-records', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || t('error'));
        toast.success(t('saveSuccess'));
        onSaved();
      } else if (record?._id) {
        const res = await fetch(`/api/full-time-work-records/${record._id}`, {
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
                    employeeId: '',
                    employeeName: '',
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
              <p className="px-3 py-2 bg-slate-50 rounded-lg text-slate-800">–</p>
            ) : (
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                disabled={!form.branchId}
              >
                <option value="">{t('all')}</option>
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
                  const emp = employeesForBranch.find((x: Employee) => x._id === e.target.value);
                  setForm((f) => ({ ...f, employeeId: e.target.value, employeeName: emp?.name || '' }));
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                required
              >
                <option value="">
                  {employeesForBranch.length === 0 && form.branchId ? 'No full-time employees in this branch' : 'Select employee...'}
                </option>
                {employeesForBranch.map((e: Employee) => (
                  <option key={e._id} value={e._id}>{e.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('month')} *</label>
            <input
              type="month"
              value={form.month}
              onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
              readOnly={mode === 'view'}
              className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${mode === 'view' ? 'bg-slate-50 cursor-default' : ''}`}
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              {t('workingDaysInMonth') || 'Working days'}: {workingDays} ({t('excludingSundays') || 'excluding Sundays'})
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-200 pt-4">
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">
              {t('daysWorked') || 'Days worked'} * (max {maxDaysAllowed})
            </label>
            <input
              type="number"
              min={0}
              max={maxDaysAllowed}
              value={form.daysWorked || ''}
              onChange={(e) => setForm((f) => ({ ...f, daysWorked: Math.min(maxDaysAllowed, Math.max(0, parseInt(e.target.value, 10) || 0)) }))}
              readOnly={mode === 'view'}
              className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${mode === 'view' ? 'bg-slate-50 cursor-default' : ''}`}
            />
            {daysAlreadyUsed > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                {daysAlreadyUsed} {t('days')} already entered for this employee this month
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('otHours') || 'Overtime hours'}</label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.otHours || ''}
              onChange={(e) => setForm((f) => ({ ...f, otHours: Math.max(0, parseFloat(e.target.value) || 0) }))}
              readOnly={mode === 'view'}
              className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${mode === 'view' ? 'bg-slate-50 cursor-default' : ''}`}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-slate-800 mb-1">{t('notes')}</label>
            <input
              type="text"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              readOnly={mode === 'view'}
              placeholder={t('optional')}
              className={`w-full px-3 py-2 border border-slate-300 rounded-lg ${mode === 'view' ? 'bg-slate-50 cursor-default' : ''}`}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-slate-200">
        {mode !== 'view' && (
          <button
            onClick={handleSave}
            disabled={saving || !form.employeeId || !form.branchId || !form.month || form.daysWorked <= 0 || form.daysWorked > maxDaysAllowed}
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
