'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import PageHeader from '@/components/PageHeader';
import { useNotifications, revalidate } from '@/lib/hooks/useApi';
import { PageLoader } from '@/components/Skeleton';

const NOTIFICATION_TYPES = [
  { value: '', labelKey: 'all' },
  { value: 'work_record_created', labelKey: 'work_record_created' },
  { value: 'work_record_updated', labelKey: 'work_record_updated' },
  { value: 'work_record_deleted', labelKey: 'work_record_deleted' },
  { value: 'payment_created', labelKey: 'payment_created' },
  { value: 'style_order_created', labelKey: 'style_order_created' },
  { value: 'style_order_updated', labelKey: 'style_order_updated' },
  { value: 'style_order_deleted', labelKey: 'style_order_deleted' },
  { value: 'employee_created', labelKey: 'employee_created' },
  { value: 'employee_updated', labelKey: 'employee_updated' },
  { value: 'birthday_reminder', labelKey: 'birthday_reminder' },
  { value: 'anniversary_reminder', labelKey: 'anniversary_reminder' },
] as const;

interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  readAt: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function NotificationsPage() {
  const { t } = useApp();
  const router = useRouter();
  const [filterUnread, setFilterUnread] = useState<boolean | ''>('');
  const [filterType, setFilterType] = useState('');
  const [page, setPage] = useState(1);

  const unreadOnly = filterUnread === true;
  const readOnly = filterUnread === false;
  const { notifications, total, hasMore, unreadCount, loading, mutate } = useNotifications({
    unreadOnly,
    readOnly,
    type: filterType || undefined,
    page,
    limit: 30,
    refreshInterval: 15000,
  });

  const handleMarkRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      mutate();
      revalidate('/api/notifications/unread-count');
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/notifications/read-all', { method: 'PATCH' });
      mutate();
      revalidate('/api/notifications/unread-count');
    } catch {
      // ignore
    }
  };

  const handleNavigate = (n: Notification) => {
    if (!n.readAt) handleMarkRead(n._id);
    router.push(n.link);
  };

  if (loading && notifications.length === 0) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('notifications')} />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-200 bg-slate-50/50">
          <select
            value={filterUnread === '' ? '' : filterUnread === true ? 'true' : 'false'}
            onChange={(e) => {
              const v = e.target.value;
              setFilterUnread(v === '' ? '' : v === 'true');
              setPage(1);
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white"
          >
            <option value="">{t('all')}</option>
            <option value="true">{t('unread')}</option>
            <option value="false">{t('read')}</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => {
              setFilterType(e.target.value);
              setPage(1);
            }}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 bg-white"
          >
            {NOTIFICATION_TYPES.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>
                {opt.value ? t(opt.labelKey) : t('all')}
              </option>
            ))}
          </select>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="ml-auto px-4 py-2 text-sm font-medium text-uff-primary hover:bg-uff-accent/20 rounded-lg transition"
            >
              {t('markAllAsRead')}
            </button>
          )}
        </div>

        {/* List */}
        <div className="divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="p-12 text-center text-slate-500">{t('noNotifications')}</div>
          ) : (
            notifications.map((n: Notification) => {
              const isUnread = !n.readAt;
              return (
                <div
                  key={n._id}
                  className={`flex items-start gap-4 p-4 transition ${
                    isUnread
                      ? 'bg-amber-50/80 hover:bg-amber-50 border-l-4 border-l-amber-400'
                      : 'bg-white hover:bg-slate-50/80 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${isUnread ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>
                      {n.title}
                    </p>
                    <p className={`mt-0.5 text-sm ${isUnread ? 'text-slate-700' : 'text-slate-500'}`}>
                      {n.message}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">{formatRelativeTime(n.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isUnread && (
                      <button
                        onClick={() => handleMarkRead(n._id)}
                        className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition"
                      >
                        {t('markAsRead')}
                      </button>
                    )}
                    <button
                      onClick={() => handleNavigate(n)}
                      className="px-3 py-1.5 text-xs font-medium bg-uff-primary text-white hover:bg-uff-primary/90 rounded-lg transition"
                    >
                      {t('viewDetails')}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {(hasMore || page > 1) && (
          <div className="flex justify-center gap-2 p-4 border-t border-slate-100">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 rounded-lg"
            >
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-slate-600">
              Page {page} of {Math.ceil(total / 30) || 1}
            </span>
            <button
              disabled={!hasMore}
              onClick={() => setPage((p) => p + 1)}
              className="px-4 py-2 text-sm font-medium text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 rounded-lg"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
