'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/contexts/AppContext';
import ValidatedInput from '@/components/ValidatedInput';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import UserAvatar from '@/components/UserAvatar';
import { ProfileSkeleton } from '@/components/Skeleton';
import { formatDate } from '@/lib/utils';

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
  const { user, refetchUser } = useAuth();
  const [data, setData] = useState<ProfileData | null>(null);
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
      <div>
        <PageHeader title={t('profile')} />
        <ProfileSkeleton />
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
                  <label className="block text-sm font-medium text-slate-700">{t('employeeName')} <span className="text-red-500" aria-hidden="true">*</span></label>
                  {editing ? (
                    <ValidatedInput
                      type="text"
                      value={editForm.name}
                      onChange={(v) => setEditForm((f) => ({ ...f, name: v }))}
                      fieldType="name"
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-slate-800">{emp.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('contactNumber')} <span className="text-red-500" aria-hidden="true">*</span></label>
                  {editing ? (
                    <ValidatedInput
                      type="tel"
                      value={editForm.contactNumber}
                      onChange={(v) => setEditForm((f) => ({ ...f, contactNumber: v }))}
                      fieldType="phone"
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-slate-800">{emp.contactNumber}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('emergencyNumber')} <span className="text-red-500" aria-hidden="true">*</span></label>
                  {editing ? (
                    <ValidatedInput
                      type="tel"
                      value={editForm.emergencyNumber}
                      onChange={(v) => setEditForm((f) => ({ ...f, emergencyNumber: v }))}
                      fieldType="phone"
                      className="mt-1"
                    />
                  ) : (
                    <p className="mt-1 text-slate-800">{emp.emergencyNumber}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">{t('dateOfBirth')}</label>
                  <p className="mt-1 text-slate-800">{emp.dateOfBirth ? formatDate(emp.dateOfBirth) : '-'}</p>
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
                        <ValidatedInput
                          type="text"
                          value={editForm.bankName}
                          onChange={(v) => setEditForm((f) => ({ ...f, bankName: v }))}
                          fieldType="bankName"
                          className="mt-1"
                        />
                      ) : (
                        <p className="mt-1 text-slate-800">{emp.bankName || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">{t('bankBranch')}</label>
                      {editing ? (
                        <ValidatedInput
                          type="text"
                          value={editForm.bankBranch}
                          onChange={(v) => setEditForm((f) => ({ ...f, bankBranch: v }))}
                          fieldType="text"
                          placeholderHint="e.g. Main Branch"
                          className="mt-1"
                        />
                      ) : (
                        <p className="mt-1 text-slate-800">{emp.bankBranch || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">{t('ifscCode')}</label>
                      {editing ? (
                        <ValidatedInput
                          type="text"
                          value={editForm.ifscCode}
                          onChange={(v) => setEditForm((f) => ({ ...f, ifscCode: v.toUpperCase() }))}
                          fieldType="ifsc"
                          maxLength={11}
                          className="mt-1"
                        />
                      ) : (
                        <p className="mt-1 text-slate-800">{emp.ifscCode || '-'}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">{t('accountNumber')}</label>
                      {editing ? (
                        <ValidatedInput
                          type="text"
                          value={editForm.accountNumber}
                          onChange={(v) => setEditForm((f) => ({ ...f, accountNumber: v.replace(/\D/g, '') }))}
                          fieldType="accountNumber"
                          className="mt-1"
                        />
                      ) : (
                        <p className="mt-1 text-slate-800">{emp.accountNumber ? `••••${emp.accountNumber.slice(-4)}` : '-'}</p>
                      )}
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-sm font-medium text-slate-700">{t('upiId')}</label>
                      {editing ? (
                        <ValidatedInput
                          type="text"
                          value={editForm.upiId}
                          onChange={(v) => setEditForm((f) => ({ ...f, upiId: v }))}
                          fieldType="upi"
                          className="mt-1"
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
                    <p className="mt-1 text-slate-800">{(emp.branches || []).map((b: { name: string }) => b.name).join(', ') || '—'}</p>
                  </div>
                )}
                {user?.employeeId && (
                  <div className="sm:col-span-2 border-t border-slate-200 pt-4 mt-2">
                    <h3 className="text-sm font-semibold text-slate-700 mb-3">{t('quickLinks')}</h3>
                    <div className="flex flex-wrap gap-3">
                      <Link
                        href="/work-records"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-uff-surface font-medium text-sm text-slate-800"
                      >
                        {t('workRecords')}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </Link>
                      <Link
                        href="/payments"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-uff-surface font-medium text-sm text-slate-800"
                      >
                        {t('payments')}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </Link>
                      <Link
                        href={`/employees/${user.employeeId}/passbook`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium text-sm"
                      >
                        {t('passbook')}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                )}
              </div>

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
