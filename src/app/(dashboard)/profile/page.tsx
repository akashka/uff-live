'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import UserAvatar from '@/components/UserAvatar';

interface WorkRecord {
  _id: string;
  branch: { name: string };
  periodStart: string;
  periodEnd: string;
  workItems: { rateName: string; unit: string; quantity: number; ratePerUnit: number; amount: number }[];
  otHours?: number;
  otAmount?: number;
  totalAmount: number;
}

interface PaymentRecord {
  _id: string;
  paymentType: string;
  periodStart: string;
  periodEnd: string;
  baseAmount: number;
  addDeductAmount: number;
  addDeductRemarks: string;
  pfDeducted: number;
  esiDeducted?: number;
  advanceDeducted?: number;
  totalPayable: number;
  paymentAmount: number;
  paymentMode: string;
  transactionRef: string;
  remainingAmount: number;
  carriedForward: number;
  isAdvance: boolean;
  paidAt: string;
}

interface ProfileData {
  user: { email: string; role: string };
  employee: {
    name: string;
    photo?: string;
    contactNumber: string;
    email: string;
    emergencyNumber: string;
    dateOfBirth: string;
    gender: string;
    aadhaarNumber?: string;
    pfNumber?: string;
    panNumber?: string;
    bankName?: string;
    bankBranch?: string;
    ifscCode?: string;
    accountNumber?: string;
    upiId?: string;
    employeeType: string;
    branches: { name: string }[];
    monthlySalary?: number;
    salaryBreakup?: { pf?: number; esi?: number; other?: number };
  } | null;
}

export default function ProfilePage() {
  const { t } = useApp();
  const { user } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
  const [workRecords, setWorkRecords] = useState<WorkRecord[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [workFilterStart, setWorkFilterStart] = useState('');
  const [workFilterEnd, setWorkFilterEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    contactNumber: '',
    emergencyNumber: '',
    bankName: '',
    bankBranch: '',
    ifscCode: '',
    accountNumber: '',
    upiId: '',
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        if (d.employee) {
          setEditForm({
            name: d.employee.name,
            contactNumber: d.employee.contactNumber,
            emergencyNumber: d.employee.emergencyNumber,
            bankName: d.employee.bankName || '',
            bankBranch: d.employee.bankBranch || '',
            ifscCode: d.employee.ifscCode || '',
            accountNumber: d.employee.accountNumber || '',
            upiId: d.employee.upiId || '',
          });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (data?.employee?.employeeType === 'contractor' && user?.employeeId) {
      let url = `/api/work-records?employeeId=${user.employeeId}`;
      if (workFilterStart) url += `&periodStart=${workFilterStart}`;
      if (workFilterEnd) url += `&periodEnd=${workFilterEnd}`;
      fetch(url)
        .then((r) => r.json())
        .then(setWorkRecords)
        .catch(() => {});
    }
  }, [data?.employee?.employeeType, user?.employeeId, workFilterStart, workFilterEnd]);

  useEffect(() => {
    if (user?.employeeId) {
      fetch(`/api/payments?employeeId=${user.employeeId}`)
        .then((r) => r.json())
        .then(setPaymentHistory)
        .catch(() => {});
    }
  }, [user?.employeeId]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      if (photoFile && user?.employeeId) {
        const fd = new FormData();
        fd.append('photo', photoFile);
        const photoRes = await fetch('/api/profile/photo', { method: 'POST', body: fd });
        if (!photoRes.ok) {
          const err = await photoRes.json();
          throw new Error(err.error || t('error'));
        }
        setPhotoFile(null);
        await refetchUser();
      }
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          contactNumber: editForm.contactNumber,
          emergencyNumber: editForm.emergencyNumber,
          bankName: editForm.bankName,
          bankBranch: editForm.bankBranch,
          ifscCode: editForm.ifscCode,
          accountNumber: editForm.accountNumber,
          upiId: editForm.upiId,
        }),
      });
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      setData((prev) => (prev && d.employee ? { ...prev, employee: d.employee } : prev));
      setEditForm({
        name: d.employee.name,
        contactNumber: d.employee.contactNumber,
        emergencyNumber: d.employee.emergencyNumber,
        bankName: d.employee.bankName || '',
        bankBranch: d.employee.bankBranch || '',
        ifscCode: d.employee.ifscCode || '',
        accountNumber: d.employee.accountNumber || '',
        upiId: d.employee.upiId || '',
      });
      setEditing(false);
      setMessage({ type: 'success', text: t('saveSuccess') });
    } catch {
      setMessage({ type: 'error', text: t('error') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin w-10 h-10 border-4 border-uff-accent border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) return <div className="text-slate-800">{t('noData')}</div>;

  const emp = data.employee;
  const roleLabels: Record<string, string> = { admin: t('admin'), finance: t('finance'), hr: t('hr'), employee: t('employee') };

  return (
    <div>
      <PageHeader title={t('profile')} />
      <div className="space-y-4">
          {message && (
            <div
              className={`p-3 rounded-lg ${message.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}
            >
              {message.text}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-700">{t('email')}</label>
              <p className="mt-1 text-slate-800">{data.user.email}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">{t('role')}</label>
              <p className="mt-1 text-slate-800">{roleLabels[data.user.role] || data.user.role}</p>
            </div>
          </div>

          {emp ? (
            <>
              <hr className="border-slate-200" />
              <h2 className="font-medium text-slate-800">{t('employeeName')} & Details</h2>
              {editing && (
                <div className="flex items-center gap-4 mb-4">
                  <div className="shrink-0">
                    {photoFile ? (
                      <img
                        src={URL.createObjectURL(photoFile)}
                        alt="Preview"
                        className="w-20 h-20 rounded-full object-cover border-2 border-slate-200"
                      />
                    ) : (
                      <UserAvatar
                        photo={emp.photo}
                        name={emp.name}
                        size="lg"
                        className="w-20 h-20"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-800 mb-1">{t('changePhoto')}</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-slate-800 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-uff-accent file:text-uff-primary file:font-medium hover:file:bg-uff-accent-hover"
                    />
                  </div>
                </div>
              )}
              {!editing && (
                <div className="flex items-center gap-4 mb-4">
                  <UserAvatar photo={emp.photo} name={emp.name} size="lg" className="w-20 h-20" />
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('employeeName')}</label>
                  {editing ? (
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                    />
                  ) : (
                    <p className="mt-1 text-slate-800">{emp.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('contactNumber')}</label>
                  {editing ? (
                    <input
                      type="tel"
                      value={editForm.contactNumber}
                      onChange={(e) => setEditForm((f) => ({ ...f, contactNumber: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                    />
                  ) : (
                    <p className="mt-1 text-slate-800">{emp.contactNumber}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('emergencyNumber')}</label>
                  {editing ? (
                    <input
                      type="tel"
                      value={editForm.emergencyNumber}
                      onChange={(e) => setEditForm((f) => ({ ...f, emergencyNumber: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                    />
                  ) : (
                    <p className="mt-1 text-slate-800">{emp.emergencyNumber}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('dateOfBirth')}</label>
                  <p className="mt-1 text-slate-800">{emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString() : '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('gender')}</label>
                  <p className="mt-1 text-slate-800">{emp.gender === 'male' ? t('male') : emp.gender === 'female' ? t('female') : t('other')}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('employeeType')}</label>
                  <p className="mt-1 text-slate-800">{emp.employeeType === 'full_time' ? t('fullTime') : t('contractor')}</p>
                </div>
                {emp.employeeType === 'full_time' && ((emp.monthlySalary ?? 0) > 0 || (emp.salaryBreakup?.pf ?? 0) > 0 || (emp.salaryBreakup?.esi ?? 0) > 0 || (emp.salaryBreakup?.other ?? 0) > 0) && (
                  <div className="sm:col-span-2 border-t border-slate-200 pt-4 mt-2">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('salaryBreakup')}</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {(emp.monthlySalary ?? 0) > 0 && (
                        <>
                          <div>
                            <label className="block text-sm font-medium text-slate-700">{t('grossSalary')}</label>
                            <p className="mt-1 text-slate-800">₹{emp.monthlySalary?.toLocaleString()}</p>
                          </div>
                          {(emp.salaryBreakup?.pf ?? 0) > 0 && (
                            <div>
                              <label className="block text-sm font-medium text-slate-700">{t('pf')}</label>
                              <p className="mt-1 text-slate-800">- ₹{(emp.salaryBreakup?.pf ?? 0).toLocaleString()}</p>
                            </div>
                          )}
                          {(emp.salaryBreakup?.esi ?? 0) > 0 && (
                            <div>
                              <label className="block text-sm font-medium text-slate-700">{t('esi')}</label>
                              <p className="mt-1 text-slate-800">- ₹{(emp.salaryBreakup?.esi ?? 0).toLocaleString()}</p>
                            </div>
                          )}
                          {(emp.salaryBreakup?.other ?? 0) > 0 && (
                            <div>
                              <label className="block text-sm font-medium text-slate-700">{t('otherDeductions')}</label>
                              <p className="mt-1 text-slate-800">- ₹{(emp.salaryBreakup?.other ?? 0).toLocaleString()}</p>
                            </div>
                          )}
                          <div>
                            <label className="block text-sm font-medium text-slate-700">{t('netSalary')}</label>
                            <p className="mt-1 font-semibold text-slate-800">
                              ₹{((emp.monthlySalary || 0) - (emp.salaryBreakup?.pf || 0) - (emp.salaryBreakup?.esi || 0) - (emp.salaryBreakup?.other || 0)).toLocaleString()}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('aadhaarNumber')}</label>
                  <p className="mt-1 text-slate-800">{emp.aadhaarNumber || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('pfNumber')}</label>
                  <p className="mt-1 text-slate-800">{emp.pfNumber || '-'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('panNumber')}</label>
                  <p className="mt-1 text-slate-800">{emp.panNumber || '-'}</p>
                </div>
                <div className="sm:col-span-2 border-t border-slate-200 pt-4 mt-2">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('bankingDetails')}</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">{t('bankName')}</label>
                      {editing ? (
                        <input
                          type="text"
                          value={editForm.bankName}
                          onChange={(e) => setEditForm((f) => ({ ...f, bankName: e.target.value }))}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                        />
                      ) : (
                        <p className="mt-1 text-slate-800">{emp.bankName || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">{t('bankBranch')}</label>
                      {editing ? (
                        <input
                          type="text"
                          value={editForm.bankBranch}
                          onChange={(e) => setEditForm((f) => ({ ...f, bankBranch: e.target.value }))}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                        />
                      ) : (
                        <p className="mt-1 text-slate-800">{emp.bankBranch || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">{t('ifscCode')}</label>
                      {editing ? (
                        <input
                          type="text"
                          value={editForm.ifscCode}
                          onChange={(e) => setEditForm((f) => ({ ...f, ifscCode: e.target.value.toUpperCase() }))}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                          maxLength={11}
                        />
                      ) : (
                        <p className="mt-1 text-slate-800">{emp.ifscCode || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">{t('accountNumber')}</label>
                      {editing ? (
                        <input
                          type="text"
                          value={editForm.accountNumber}
                          onChange={(e) => setEditForm((f) => ({ ...f, accountNumber: e.target.value.replace(/\D/g, '') }))}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                        />
                      ) : (
                        <p className="mt-1 text-slate-800">{emp.accountNumber ? `••••${emp.accountNumber.slice(-4)}` : '-'}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700">{t('upiId')}</label>
                      {editing ? (
                        <input
                          type="text"
                          value={editForm.upiId}
                          onChange={(e) => setEditForm((f) => ({ ...f, upiId: e.target.value }))}
                          className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-uff-accent"
                        />
                      ) : (
                        <p className="mt-1 text-slate-800">{emp.upiId || '-'}</p>
                      )}
                    </div>
                  </div>
                </div>
                {emp.branches?.length > 0 && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700">{t('branches')}</label>
                    <p className="mt-1 text-slate-800">{emp.branches.map((b: { name: string }) => b.name).join(', ')}</p>
                  </div>
                )}
              </div>

              {emp.employeeType === 'contractor' && (
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('workRecords')}</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <input
                      type="date"
                      value={workFilterStart}
                      onChange={(e) => setWorkFilterStart(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      placeholder={t('periodStart')}
                    />
                    <input
                      type="date"
                      value={workFilterEnd}
                      onChange={(e) => setWorkFilterEnd(e.target.value)}
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      placeholder={t('periodEnd')}
                    />
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {workRecords.length === 0 ? (
                      <p className="text-slate-600 text-sm">{t('noData')}</p>
                    ) : (
                      workRecords.map((rec) => (
                        <div key={rec._id} className="p-4 rounded-lg bg-uff-surface border border-slate-200">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium">{(rec.branch as { name?: string })?.name}</span>
                            <span className="text-slate-800">
                              {rec.periodStart?.slice(0, 10)} – {rec.periodEnd?.slice(0, 10)}
                            </span>
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-slate-600">
                                <th className="text-left py-1">{t('rateName')}</th>
                                <th className="text-right py-1">Qty</th>
                                <th className="text-right py-1">Rate</th>
                                <th className="text-right py-1">{t('amount')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(rec.workItems || []).map((wi, i) => (
                                <tr key={i} className="border-t border-slate-200">
                                  <td className="py-1">{wi.rateName}</td>
                                  <td className="text-right">{wi.quantity}</td>
                                  <td className="text-right">₹{wi.ratePerUnit}</td>
                                  <td className="text-right font-medium">₹{wi.amount?.toLocaleString()}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {((rec.otHours ?? 0) > 0 || (rec.otAmount ?? 0) > 0) && (
                            <p className="text-right text-sm text-slate-800 mt-1">
                              {t('otHours')}: {(rec.otHours ?? 0)} hrs | {t('otAmount')}: ₹{(rec.otAmount ?? 0).toLocaleString()}
                            </p>
                          )}
                          <p className="text-right font-semibold mt-2 pt-2 border-t border-slate-200">
                            {t('totalAmount')}: ₹{rec.totalAmount?.toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {emp && (
                <div className="border-t border-slate-200 pt-4 mt-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('paymentHistory')}</h3>
                  <p className="text-xs text-slate-600 mb-2">{t('paymentHistoryHint')}</p>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {paymentHistory.length === 0 ? (
                      <p className="text-slate-600 text-sm">{t('noData')}</p>
                    ) : (
                      paymentHistory.map((p) => (
                        <div key={p._id} className="p-4 rounded-lg bg-uff-surface border border-slate-200">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="font-medium">{p.periodStart?.slice(0, 10)} – {p.periodEnd?.slice(0, 10)}</span>
                            <span className={p.remainingAmount > 0 ? 'text-uff-accent' : 'text-green-600'}>
                              ₹{p.paymentAmount?.toLocaleString()} {p.remainingAmount > 0 ? `(${t('due')}: ₹${p.remainingAmount?.toLocaleString()})` : ''}
                            </span>
                          </div>
                          <div className="text-xs text-slate-800 space-y-1">
                            <p>{t('baseAmount')}: ₹{p.baseAmount?.toLocaleString()}
                              {p.addDeductAmount !== 0 && ` | ${t('addDeduct')}: ${p.addDeductAmount > 0 ? '+' : ''}₹${p.addDeductAmount?.toLocaleString()}`}
                              {p.pfDeducted > 0 && ` | ${t('pf')}: -₹${p.pfDeducted?.toLocaleString()}`}
                              {(p.esiDeducted ?? 0) > 0 && ` | ${t('esi')}: -₹${(p.esiDeducted ?? 0).toLocaleString()}`}
                              {((p.advanceDeducted ?? 0) > 0 && ` | ${t('advance')}: -₹${(p.advanceDeducted ?? 0).toLocaleString()}`)}
                            </p>
                            <p>{t('totalPayable')}: ₹{p.totalPayable?.toLocaleString()} | {t('paymentMode')}: {p.paymentMode}
                              {p.transactionRef && ` | Ref: ${p.transactionRef}`}
                            </p>
                            {p.addDeductRemarks && <p>{t('remarks')}: {p.addDeductRemarks}</p>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {editing ? (
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50"
                  >
                    {saving ? '...' : t('save')}
                  </button>
                  <button
                    onClick={() => {
                      setEditing(false);
                      setEditForm({
                        name: emp.name,
                        contactNumber: emp.contactNumber,
                        emergencyNumber: emp.emergencyNumber,
                        bankName: emp.bankName || '',
                        bankBranch: emp.bankBranch || '',
                        ifscCode: emp.ifscCode || '',
                        accountNumber: emp.accountNumber || '',
                        upiId: emp.upiId || '',
                      });
                    }}
                    className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-uff-surface"
                  >
                    {t('cancel')}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="mt-4 px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white font-medium"
                >
                  {t('edit')}
                </button>
              )}
            </>
          ) : (
            <p className="text-slate-800">{t('noData')}</p>
          )}
      </div>
    </div>
  );
}
