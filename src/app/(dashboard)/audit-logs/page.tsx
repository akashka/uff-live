'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import { PageLoader } from '@/components/Skeleton';
import { toast } from '@/lib/toast';

interface AuditLogEntry {
  _id: string;
  action: string;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  entityType: string;
  entityId: string | null;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const ACTION_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'branch_create', label: 'Branch created' },
  { value: 'branch_update', label: 'Branch updated' },
  { value: 'employee_create', label: 'Employee created' },
  { value: 'employee_update', label: 'Employee updated' },
  { value: 'user_create', label: 'User created' },
  { value: 'user_update', label: 'User updated' },
  { value: 'rate_create', label: 'Rate created' },
  { value: 'rate_update', label: 'Rate updated' },
  { value: 'rate_import', label: 'Rates imported' },
  { value: 'style_order_create', label: 'Style order created' },
  { value: 'style_order_update', label: 'Style order updated' },
  { value: 'style_order_delete', label: 'Style order deleted' },
  { value: 'work_record_create', label: 'Work record created' },
  { value: 'work_record_update', label: 'Work record updated' },
  { value: 'work_record_delete', label: 'Work record deleted' },
  { value: 'payment_create', label: 'Payment created' },
  { value: 'profile_update', label: 'Profile updated' },
  { value: 'profile_photo_update', label: 'Profile photo updated' },
  { value: 'profile_document_upload', label: 'Profile document uploaded' },
];

const ENTITY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'auth', label: 'Auth' },
  { value: 'branch', label: 'Branch' },
  { value: 'employee', label: 'Employee' },
  { value: 'user', label: 'User' },
  { value: 'rate', label: 'Rate' },
  { value: 'style_order', label: 'Style Order' },
  { value: 'work_record', label: 'Work Record' },
  { value: 'payment', label: 'Payment' },
];

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function AuditLogsPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  const canAccess = user?.role === 'admin';

  const fetchLogs = (pageNum: number = 1, reset = false) => {
    if (!canAccess) return;
    if (reset) setLoading(true);
    const params = new URLSearchParams({
      page: String(pageNum),
      limit: '50',
    });
    if (filterAction) params.set('action', filterAction);
    if (filterEntity) params.set('entityType', filterEntity);

    fetch(`/api/audit-logs?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error('Fetch failed');
        return r.json();
      })
      .then((data) => {
        const list = Array.isArray(data?.data) ? data.data : [];
        if (reset) {
          setLogs(list);
        } else {
          setLogs((prev) => (pageNum === 1 ? list : [...prev, ...list]));
        }
        setTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setPage(pageNum);
      })
      .catch(() => toast.error(t('error')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!canAccess) return;
    fetchLogs(1, true);
  }, [canAccess, filterAction, filterEntity]);

  if (!canAccess) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-800">
        {t('accessDenied')}
      </div>
    );
  }

  if (loading && logs.length === 0) {
    return (
      <div>
        <PageHeader title={t('auditLog')} />
        <PageLoader mode="table" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={t('auditLog')} />

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <span>{t('filterByAction')}:</span>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.value ? formatAction(opt.value) : t('all')}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-800">
          <span>{t('filterByEntity')}:</span>
          <select
            value={filterEntity}
            onChange={(e) => setFilterEntity(e.target.value)}
            className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white"
          >
            {ENTITY_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.value ? formatAction(opt.value) : t('all')}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('auditTime')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('auditActor')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('auditAction')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('auditEntityType')}</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('auditSummary')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-slate-600">
                    {t('noData')}
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-slate-800">
                      <span className="font-medium">{log.actorEmail || '—'}</span>
                      {log.actorRole && (
                        <span className="ml-1 text-xs text-slate-500">({log.actorRole})</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-800">
                        {formatAction(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-800">{formatAction(log.entityType)}</td>
                    <td className="px-4 py-3 text-slate-800 max-w-md truncate" title={log.summary}>
                      {log.summary}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="px-4 py-3 border-t border-slate-200 text-center">
            <button
              onClick={() => fetchLogs(page + 1, false)}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50"
            >
              {loading ? t('loading') : t('loadMore')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
