'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import { PageLoader } from '@/components/Skeleton';
import { toast } from '@/lib/toast';

interface HealthData {
  status: string;
  database: { status: string; latencyMs: number };
  api: { totalRequests: number; errorCount: number; errorRate: number; avgLatencyMs: number; p95LatencyMs: number };
  uptimeSeconds: number;
  maintenanceMode: boolean;
  timestamp: string;
}

interface RetentionPolicies {
  auditLogsDays: number;
  notificationsDays: number;
}

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

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  update: 'bg-amber-100 text-amber-800 border-amber-200',
  delete: 'bg-rose-100 text-rose-800 border-rose-200',
  login: 'bg-blue-100 text-blue-800 border-blue-200',
  logout: 'bg-slate-100 text-slate-700 border-slate-200',
};

function getActionStyle(action: string): string {
  if (action.includes('create')) return ACTION_COLORS.create;
  if (action.includes('update') || action.includes('import')) return ACTION_COLORS.update;
  if (action.includes('delete')) return ACTION_COLORS.delete;
  if (action === 'login') return ACTION_COLORS.login;
  if (action === 'logout') return ACTION_COLORS.logout;
  return 'bg-violet-100 text-violet-800 border-violet-200';
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

type TabId = 'system' | 'audit';

export default function SystemPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tabFromUrl = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(tabFromUrl === 'audit' ? 'audit' : 'system');

  useEffect(() => {
    if (tabFromUrl === 'audit') setActiveTab('audit');
  }, [tabFromUrl]);

  const switchTab = (tab: TabId) => {
    setActiveTab(tab);
    const url = tab === 'audit' ? '/system?tab=audit' : '/system';
    router.replace(url, { scroll: false });
  };

  // System state
  const [health, setHealth] = useState<HealthData | null>(null);
  const [retention, setRetention] = useState<RetentionPolicies | null>(null);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [purging, setPurging] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [retentionForm, setRetentionForm] = useState({ auditLogsDays: 365, notificationsDays: 90 });

  // Audit state
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filterAction, setFilterAction] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  const canAccess = user?.role === 'admin';

  useEffect(() => {
    if (!canAccess) return;
    Promise.all([
      fetch('/api/system/health').then((r) => r.json()),
      fetch('/api/system/retention').then((r) => r.json()),
    ])
      .then(([healthRes, retentionRes]) => {
        if (healthRes?.database) setHealth(healthRes);
        if (retentionRes?.policies) {
          setRetention(retentionRes.policies);
          setRetentionForm(retentionRes.policies);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [canAccess]);

  const fetchLogs = (pageNum = 1, reset = false) => {
    if (!canAccess) return;
    if (reset) setLogsLoading(true);
    const params = new URLSearchParams({ page: String(pageNum), limit: '50' });
    if (filterAction) params.set('action', filterAction);
    if (filterEntity) params.set('entityType', filterEntity);
    fetch(`/api/audit-logs?${params}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Fetch failed'))))
      .then((data) => {
        const list = Array.isArray(data?.data) ? data.data : [];
        setLogs((prev) => (reset || pageNum === 1 ? list : [...prev, ...list]));
        setLogsTotal(data.total ?? 0);
        setHasMore(data.hasMore ?? false);
        setLogsPage(pageNum);
      })
      .catch(() => toast.error(t('error')))
      .finally(() => setLogsLoading(false));
  };

  useEffect(() => {
    if (!canAccess || activeTab !== 'audit') return;
    fetchLogs(1, true);
  }, [canAccess, activeTab, filterAction, filterEntity]);

  const refreshHealth = () => {
    fetch('/api/system/health')
      .then((r) => r.json())
      .then((d) => d?.database && setHealth(d))
      .catch(() => {});
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const res = await fetch('/api/system/backup', { method: 'POST' });
      if (!res.ok) throw new Error('Backup failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Backup failed');
    } finally {
      setBackingUp(false);
    }
  };

  const handleRestore = async () => {
    if (!restoreFile) {
      toast.error('Select a backup file first');
      return;
    }
    if (!confirm('Restore will REPLACE all current data. This cannot be undone. Continue?')) return;
    setRestoring(true);
    try {
      const fd = new FormData();
      fd.append('file', restoreFile);
      const res = await fetch('/api/system/restore', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');
      toast.success('Restore completed. Please refresh the page.');
      setRestoreFile(null);
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  const handleSaveRetention = async () => {
    try {
      const res = await fetch('/api/system/retention', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(retentionForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setRetention(data.policies);
      toast.success('Retention policies saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed');
    }
  };

  const handlePurge = async () => {
    if (!confirm('Purge old audit logs and notifications per retention policy. Continue?')) return;
    setPurging(true);
    try {
      const res = await fetch('/api/system/retention/purge', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Purge failed');
      toast.success(`Purged: ${data.purged?.auditLogs ?? 0} audit logs, ${data.purged?.notifications ?? 0} notifications`);
      refreshHealth();
      if (activeTab === 'audit') fetchLogs(1, true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Purge failed');
    } finally {
      setPurging(false);
    }
  };

  if (!canAccess) {
    return (
      <div className="rounded-2xl bg-rose-50 border-2 border-rose-200 p-8 text-center">
        <p className="text-rose-800 font-medium">{t('accessDenied')}</p>
      </div>
    );
  }

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'system', label: 'System', icon: '⚙️' },
    { id: 'audit', label: 'Audit Log', icon: '📋' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t('system') || 'System'} />

      {/* Tabs */}
      <div className="flex gap-2 p-1 rounded-xl bg-slate-100 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => switchTab(tab.id)}
            className={`px-5 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'system' && (
        <>
          {loading ? (
            <div className="animate-pulse h-64 rounded-2xl bg-slate-100" />
          ) : (
            <div className="space-y-6">
              {/* Health - colourful cards */}
              <section className="rounded-2xl overflow-hidden shadow-lg">
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white">
                  <h2 className="text-lg font-semibold">System Health</h2>
                  <p className="text-emerald-100 text-sm mt-0.5">Database & API status</p>
                </div>
                <div className="bg-white p-6 border-x border-b border-slate-200">
                  <div className="flex flex-wrap gap-4 items-center mb-4">
                    <span
                      className={`px-4 py-2 rounded-xl text-sm font-semibold ${
                        health?.status === 'healthy'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {health?.status === 'healthy' ? '✓ Healthy' : '⚠ Degraded'}
                    </span>
                    <span className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-medium">
                      DB: {health?.database?.status} ({health?.database?.latencyMs}ms)
                    </span>
                    <span className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-medium">
                      Uptime: {health?.uptimeSeconds != null ? `${Math.floor(health.uptimeSeconds / 3600)}h ${Math.floor((health.uptimeSeconds % 3600) / 60)}m` : '—'}
                    </span>
                    {health?.maintenanceMode && (
                      <span className="px-4 py-2 rounded-xl bg-amber-100 text-amber-800 text-sm font-medium">
                        Maintenance Mode
                      </span>
                    )}
                    <button
                      onClick={refreshHealth}
                      className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition"
                    >
                      Refresh
                    </button>
                  </div>
                  {health?.api && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Requests (1h)', value: health.api.totalRequests, color: 'from-blue-500 to-indigo-600' },
                        { label: 'Error Rate', value: `${health.api.errorRate?.toFixed(1)}%`, color: 'from-rose-500 to-pink-600' },
                        { label: 'Avg Latency', value: `${health.api.avgLatencyMs}ms`, color: 'from-violet-500 to-purple-600' },
                        { label: 'P95 Latency', value: `${health.api.p95LatencyMs}ms`, color: 'from-amber-500 to-orange-600' },
                      ].map((m) => (
                        <div
                          key={m.label}
                          className={`rounded-xl bg-gradient-to-br ${m.color} p-4 text-white shadow-md`}
                        >
                          <p className="text-white/80 text-xs font-medium">{m.label}</p>
                          <p className="text-xl font-bold mt-1">{m.value}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Backup & Restore */}
              <section className="rounded-2xl overflow-hidden shadow-lg border border-slate-200">
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 p-6 text-white">
                  <h2 className="text-lg font-semibold">Backup & Restore</h2>
                  <p className="text-violet-100 text-sm mt-0.5">Export or restore all data</p>
                </div>
                <div className="bg-white p-6 border-x border-b border-slate-200">
                  <div className="flex flex-wrap gap-4">
                    <button
                      onClick={handleBackup}
                      disabled={backingUp}
                      className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium shadow-md disabled:opacity-50 transition"
                    >
                      {backingUp ? 'Creating...' : '⬇ Download Backup'}
                    </button>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept=".json"
                        onChange={(e) => setRestoreFile(e.target.files?.[0] || null)}
                        className="text-sm file:mr-2 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-rose-100 file:text-rose-800 file:font-medium"
                      />
                      <button
                        onClick={handleRestore}
                        disabled={restoring || !restoreFile}
                        className="px-5 py-2.5 rounded-xl border-2 border-rose-300 text-rose-700 font-medium hover:bg-rose-50 disabled:opacity-50 transition"
                      >
                        {restoring ? 'Restoring...' : 'Restore'}
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-500">Backup downloads all data as JSON. Restore replaces current data.</p>
                </div>
              </section>

              {/* Maintenance & Retention */}
              <div className="grid gap-6 sm:grid-cols-2">
                <section className="rounded-2xl overflow-hidden shadow-lg border border-slate-200">
                  <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-6 text-white">
                    <h2 className="text-lg font-semibold">Maintenance Mode</h2>
                    <p className="text-amber-100 text-sm mt-0.5">Read-only during upgrades</p>
                  </div>
                  <div className="bg-white p-6 border-x border-b border-slate-200">
                    <p className="text-sm text-slate-600">
                      Set <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono text-xs">MAINTENANCE_MODE=true</code> in your environment and restart.
                    </p>
                  </div>
                </section>

                <section className="rounded-2xl overflow-hidden shadow-lg border border-slate-200">
                  <div className="bg-gradient-to-r from-cyan-500 to-blue-600 p-6 text-white">
                    <h2 className="text-lg font-semibold">Data Retention</h2>
                    <p className="text-cyan-100 text-sm mt-0.5">Archive or purge old data</p>
                  </div>
                  <div className="bg-white p-6 border-x border-b border-slate-200 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Audit logs (days)</label>
                      <input
                        type="number"
                        min={30}
                        max={3650}
                        value={retentionForm.auditLogsDays}
                        onChange={(e) => setRetentionForm((f) => ({ ...f, auditLogsDays: parseInt(e.target.value, 10) || 365 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Notifications (days)</label>
                      <input
                        type="number"
                        min={7}
                        max={365}
                        value={retentionForm.notificationsDays}
                        onChange={(e) => setRetentionForm((f) => ({ ...f, notificationsDays: parseInt(e.target.value, 10) || 90 }))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveRetention}
                        className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white font-medium transition"
                      >
                        Save
                      </button>
                      <button
                        onClick={handlePurge}
                        disabled={purging}
                        className="px-4 py-2 rounded-xl border border-slate-300 font-medium hover:bg-slate-50 disabled:opacity-50 transition"
                      >
                        {purging ? 'Purging...' : 'Purge Now'}
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'audit' && (
        <section className="rounded-2xl overflow-hidden shadow-lg border border-slate-200">
          <div className="bg-gradient-to-r from-slate-600 to-slate-800 p-6 text-white">
            <h2 className="text-lg font-semibold">Audit Log</h2>
            <p className="text-slate-300 text-sm mt-0.5">Activity trail</p>
          </div>
          <div className="bg-white p-6 border-x border-b border-slate-200">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-xl text-slate-800 bg-white focus:ring-2 focus:ring-slate-400"
              >
                {ACTION_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.value ? formatAction(opt.value) : t('all')}
                  </option>
                ))}
              </select>
              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-xl text-slate-800 bg-white focus:ring-2 focus:ring-slate-400"
              >
                {ENTITY_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.value ? formatAction(opt.value) : t('all')}
                  </option>
                ))}
              </select>
            </div>

            {logsLoading && logs.length === 0 ? (
              <div className="animate-pulse h-48 rounded-xl bg-slate-100" />
            ) : (
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{t('auditTime')}</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{t('auditActor')}</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{t('auditAction')}</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{t('auditEntityType')}</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">{t('auditSummary')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                            {t('noData')}
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => (
                          <tr key={log._id} className="hover:bg-slate-50/80 transition">
                            <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">
                              {formatDate(log.createdAt)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="font-medium text-slate-800">{log.actorEmail || '—'}</span>
                              {log.actorRole && (
                                <span className="ml-1 text-xs text-slate-500">({log.actorRole})</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${getActionStyle(log.action)}`}>
                                {formatAction(log.action)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-slate-700 font-medium">{formatAction(log.entityType)}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-700 max-w-md truncate" title={log.summary}>
                              {log.summary}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                {hasMore && (
                  <div className="px-4 py-3 border-t border-slate-200 text-center bg-slate-50">
                    <button
                      onClick={() => fetchLogs(logsPage + 1, false)}
                      disabled={logsLoading}
                      className="px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-medium disabled:opacity-50 transition"
                    >
                      {logsLoading ? t('loading') : t('loadMore')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
