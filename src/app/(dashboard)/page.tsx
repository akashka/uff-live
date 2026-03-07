'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import {
  PaymentsTrendChart,
  WorkTrendChart,
  PaymentModeChart,
  EmployeeTypeChart,
  StyleWiseProductionChart,
  StyleCompletionChart,
  type StyleWiseItem,
} from '@/components/dashboard/DashboardCharts';
import { Skeleton, DashboardSkeleton } from '@/components/Skeleton';
import { AnimatePresence } from 'framer-motion';
import { Animated, AnimatedStagger, AnimatedItem } from '@/components/Animated';
import { useDashboardStats, useReminders } from '@/lib/hooks/useApi';

const DASHBOARD_CONFIG_KEY = 'uff-dashboard-widgets';

interface DashboardStats {
  employees?: { total: number; active: number; contractors: number; fullTime: number };
  fullTimeDaysWorked?: {
    currentMonth: string;
    recorded: number;
    avgDaysWorked: number | null;
    fullAttendance: number;
    totalFullTime: number;
  };
  branches?: number;
  styleOrders?: {
    count: number;
    workRecordsWithStyle: number;
    workAmountWithStyle: number;
    byStyle?: StyleWiseItem[];
    completedCount?: number;
    behindCount?: number;
    overallCompletion?: number;
    totalOrderQty?: number;
    totalProduced?: number;
    estimatedRemaining?: number;
    estCompletionDays?: number | null;
    suggestions?: string[];
  };
  alerts?: { type: string; message: string; priority: string; href?: string }[];
  payments?: {
    totalPaid: number;
    totalPayable: number;
    totalRemaining: number;
    count: number;
    byMode: Record<string, number>;
    trend: { month: string; paid: number; count: number }[];
  };
  workRecords?: {
    total: number;
    count: number;
    trend: { month: string; amount: number; count: number }[];
  };
  myStats?: {
    employeeType: string;
    workRecords: number;
    workTotal: number;
    payments: number;
    paidTotal: number;
    paidTotalPayable: number;
    dueTotal: number;
    workTrend?: { month: string; amount: number; count: number }[];
    paymentTrend?: { month: string; paid: number; count: number }[];
  };
}

const PAYMENT_MODE_LABELS: Record<string, string> = {
  cash: 'Cash',
  upi: 'UPI',
  bank_transfer: 'Bank Transfer',
  cheque: 'Cheque',
  other: 'Other',
};

export default function HomePage() {
  const { t } = useApp();
  const { user } = useAuth();
  const [range, setRange] = useState('1'); // 1=current month, 3=last 3 months, 6=last 6 months
  const { stats, loading } = useDashboardStats(range);
  const { birthdays, anniversaries } = useReminders();
  const [config, setConfig] = useState<Record<string, boolean>>({});
  const [configOpen, setConfigOpen] = useState(false);

  const isAdmin = user?.role === 'admin';
  const isFinance = ['admin', 'finance'].includes(user?.role || '');
  const isHR = ['admin', 'finance', 'hr'].includes(user?.role || '');
  const isEmployee = !!user?.employeeId;

  useEffect(() => {
    const saved = localStorage.getItem(DASHBOARD_CONFIG_KEY);
    if (saved) {
      try {
        setConfig(JSON.parse(saved));
      } catch {
        setConfig({});
      }
    } else {
      setConfig({
        overview: true,
        employees: true,
        branches: true,
        styleOrders: true,
        styleWiseChart: true,
        styleSuggestions: true,
        payments: true,
        workRecords: true,
        paymentTrend: true,
        workTrend: true,
        paymentMode: true,
        employeeType: true,
        fullTimeDaysWorked: true,
        myStats: true,
        myWorkTrend: true,
        myPaymentTrend: true,
      });
    }
  }, []);


  const toggleWidget = (key: string) => {
    const next = { ...config, [key]: !config[key] };
    setConfig(next);
    localStorage.setItem(DASHBOARD_CONFIG_KEY, JSON.stringify(next));
  };

  const paymentModeData = stats?.payments?.byMode
    ? Object.entries(stats.payments.byMode).map(([name, value]) => ({
        name: PAYMENT_MODE_LABELS[name] || name,
        value: Number(value),
      }))
    : [];

  if (loading) {
    return (
      <div className="space-y-8">
        <PageHeader title={t('dashboard')}>
          <Skeleton className="h-10 w-32" variant="rect" />
        </PageHeader>
        <DashboardSkeleton />
      </div>
    );
  }

  return (
    <Animated className="relative">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-amber-200/20 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-72 w-72 rounded-full bg-violet-200/15 blur-3xl" />
        <div className="absolute -bottom-20 right-1/3 h-60 w-60 rounded-full bg-emerald-200/15 blur-3xl" />
      </div>
      <div className="space-y-8">
      <PageHeader
        title={`${t('dashboard')} — ${user?.role === 'admin' ? t('admin') : user?.role === 'finance' ? t('finance') : user?.role === 'hr' ? t('hr') : t('employee')}`}
      >
        <div className="flex items-center gap-2">
          <select
                value={range}
            onChange={(e) => setRange(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 shadow-sm focus:border-uff-accent focus:ring-2 focus:ring-uff-accent/20"
          >
            <option value="1">{t('currentMonthOption')}</option>
            <option value="3">{t('last3Months')}</option>
            <option value="6">{t('last6Months')}</option>
          </select>
          {(isAdmin || isFinance || isHR || isEmployee) && (
            <button
              onClick={() => setConfigOpen(!configOpen)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm hover:bg-uff-surface"
            >
              {t('customize')}
            </button>
          )}
        </div>
      </PageHeader>
      <p className="-mt-4 mb-6 text-slate-600">{t('dashboardWelcome')}</p>

      {/* Birthdays & Anniversaries */}
      {(config.reminders ?? true) && (birthdays.length > 0 || anniversaries.length > 0) && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">{t('todaysCelebrations')}</h2>
          <AnimatedStagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {birthdays.map((b) => (
              <AnimatedItem key={`b-${b._id}`}>
                <Link
                  href={`/employees/${b._id}`}
                  className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 transition hover:shadow-md hover:border-rose-300"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500 text-lg text-white">🎂</span>
                  <div>
                    <p className="font-medium text-slate-800">{b.name}</p>
                    <p className="text-sm text-rose-700">{t('birthday')}</p>
                  </div>
                </Link>
              </AnimatedItem>
            ))}
            {anniversaries.map((a) => (
              <AnimatedItem key={`a-${a._id}`}>
                <Link
                  href={`/employees/${a._id}`}
                  className="flex items-center gap-3 rounded-xl border border-violet-200 bg-violet-50 p-4 transition hover:shadow-md hover:border-violet-300"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-500 text-lg text-white">💍</span>
                  <div>
                    <p className="font-medium text-slate-800">{a.name}</p>
                    <p className="text-sm text-violet-700">{t('anniversary')}</p>
                  </div>
                </Link>
              </AnimatedItem>
            ))}
          </AnimatedStagger>
        </section>
      )}

      {/* Alerts */}
      {(stats?.alerts?.length ?? 0) > 0 && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">{t('alerts')}</h2>
          <AnimatedStagger className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(stats.alerts as { type: string; message: string; priority: string; href?: string }[]).map((a, i) => (
              <AnimatedItem key={i}>
                <Link
                  href={a.href || '#'}
                  className={`flex items-start gap-3 rounded-xl border p-4 transition hover:shadow-md ${
                    a.priority === 'high' ? 'border-rose-200 bg-rose-50' : a.priority === 'medium' ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <span className={`mt-0.5 shrink-0 text-lg ${a.priority === 'high' ? 'text-rose-500' : a.priority === 'medium' ? 'text-amber-500' : 'text-slate-500'}`}>!</span>
                  <span className="text-sm font-medium text-slate-800">{a.message}</span>
                </Link>
              </AnimatedItem>
            ))}
          </AnimatedStagger>
        </section>
      )}

      <AnimatePresence>
        {configOpen && (
          <Animated className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <h3 className="mb-4 font-semibold text-slate-900">{t('customizeDashboard')}</h3>
          <div className="flex flex-wrap gap-3">
            {isHR && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.employees ?? true}
                    onChange={() => toggleWidget('employees')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('employees')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.employeeType ?? true}
                    onChange={() => toggleWidget('employeeType')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('employeeType')} Chart</span>
                </label>
              </>
            )}
            {isAdmin && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.branches ?? true}
                    onChange={() => toggleWidget('branches')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('branches')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.styleOrders ?? true}
                    onChange={() => toggleWidget('styleOrders')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('styleOrders')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.styleWiseChart ?? true}
                    onChange={() => toggleWidget('styleWiseChart')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('styleWiseProduction')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.styleSuggestions ?? true}
                    onChange={() => toggleWidget('styleSuggestions')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('suggestions')}</span>
                </label>
              </>
            )}
            {isFinance && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.payments ?? true}
                    onChange={() => toggleWidget('payments')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('payments')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.paymentTrend ?? true}
                    onChange={() => toggleWidget('paymentTrend')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('paymentTrend')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.paymentMode ?? true}
                    onChange={() => toggleWidget('paymentMode')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('paymentMode')} Chart</span>
                </label>
              </>
            )}
            {isHR && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.workRecords ?? true}
                    onChange={() => toggleWidget('workRecords')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('workRecords')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.workTrend ?? true}
                    onChange={() => toggleWidget('workTrend')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('workTrend')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.fullTimeDaysWorked ?? true}
                    onChange={() => toggleWidget('fullTimeDaysWorked')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('daysWorked')} ({t('fullTime')})</span>
                </label>
              </>
            )}
            {isEmployee && (
              <>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.myStats ?? true}
                    onChange={() => toggleWidget('myStats')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('mySummary')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.myWorkTrend ?? true}
                    onChange={() => toggleWidget('myWorkTrend')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('myWorkTrend')}</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.myPaymentTrend ?? true}
                    onChange={() => toggleWidget('myPaymentTrend')}
                    className="rounded border-slate-400"
                  />
                  <span className="text-sm text-slate-800">{t('myPaymentTrend')}</span>
                </label>
              </>
            )}
            {(isAdmin || isFinance || isHR || isEmployee) && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.reminders ?? true}
                  onChange={() => toggleWidget('reminders')}
                  className="rounded border-slate-400"
                />
                <span className="text-sm text-slate-800">{t('birthdaysAnniversaries')}</span>
              </label>
            )}
          </div>
          </Animated>
        )}
      </AnimatePresence>

      {/* Overview - Employee */}
      {isEmployee && (config.myStats ?? true) && stats?.myStats && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">{t('overview')}</h2>
          <AnimatedStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AnimatedItem><StatCard
              title={stats.myStats.employeeType === 'contractor' ? t('workRecords') : t('monthlySalary')}
              value={stats.myStats.employeeType === 'contractor' ? stats.myStats.workRecords : 1}
              subtitle={stats.myStats.employeeType === 'contractor' ? `₹${stats.myStats.workTotal?.toLocaleString()} total` : t('fixedMonthly')}
              icon={<UsersIcon />}
              href="/work-records"
              gradient="from-violet-500 to-purple-600"
            /></AnimatedItem>
            <AnimatedItem><StatCard
              title={t('payments')}
              value={stats.myStats.payments}
              subtitle={`₹${stats.myStats.paidTotal?.toLocaleString()} received`}
              icon={<PaymentIcon />}
              href="/payments"
              gradient="from-emerald-500 to-teal-600"
            /></AnimatedItem>
            <AnimatedItem><StatCard
              title={t('totalAmount')}
              value={`₹${stats.myStats.paidTotalPayable?.toLocaleString()}`}
              subtitle={t('totalPayable')}
              icon={<AmountIcon />}
              gradient="from-amber-500 to-orange-600"
            /></AnimatedItem>
            <AnimatedItem><StatCard
              title={t('remainingDue')}
              value={`₹${stats.myStats.dueTotal?.toLocaleString()}`}
              subtitle={stats.myStats.dueTotal > 0 ? t('due') : t('paid')}
              icon={<DueIcon />}
              gradient={stats.myStats.dueTotal > 0 ? 'from-rose-500 to-pink-600' : 'from-slate-500 to-slate-600'}
            /></AnimatedItem>
          </AnimatedStagger>
          {stats.myStats.employeeType === 'contractor' && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 p-6 text-white shadow-xl">
            <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
            <h3 className="relative text-sm font-medium opacity-90">{t('estimatedNextPayment')}</h3>
            <p className="relative mt-1 text-sm opacity-90">
              {stats.myStats.workRecords > 0
                ? t('estimatedNextPaymentHint')
                : t('estimatedNextPaymentNoData')}
            </p>
            <p className="relative mt-2 text-lg font-semibold">
              {stats.myStats.workRecords > 0 && stats.myStats.payments > 0
                ? `~₹${Math.round((stats.myStats.workTotal || 0) / Math.max(1, stats.myStats.workRecords || 1) * 2).toLocaleString()} ${t('perMonth')}`
                : stats.myStats.workRecords > 0
                  ? t('pendingWorkRecords')
                  : t('noData')}
            </p>
          </div>
          )}
        </section>
      )}

      {/* Overview - People & Organization */}
      {(isHR || isAdmin) && (config.employees ?? true) && stats?.employees && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">{t('overview')}</h2>
          <AnimatedStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AnimatedItem><StatCard
              title={t('employees')}
              value={stats.employees.active}
              subtitle={`${stats.employees.total} total`}
              icon={<UsersIcon />}
              href="/employees"
              gradient="from-blue-500 to-indigo-600"
            /></AnimatedItem>
            <AnimatedItem><StatCard
              title={t('contractor')}
              value={stats.employees.contractors}
              subtitle={t('contractors')}
              icon={<ContractorIcon />}
              href="/employees"
              gradient="from-amber-500 to-orange-600"
            /></AnimatedItem>
            <AnimatedItem><StatCard
              title={t('fullTime')}
              value={stats.employees.fullTime}
              subtitle={t('fullTime')}
              icon={<FullTimeIcon />}
              href="/employees"
              gradient="from-emerald-500 to-teal-600"
            /></AnimatedItem>
            {isAdmin && (config.branches ?? true) && stats?.branches !== undefined ? (
              <AnimatedItem><StatCard
                title={t('branches')}
                value={stats.branches}
                icon={<BranchIcon />}
                href="/branches"
                gradient="from-violet-500 to-purple-600"
              /></AnimatedItem>
            ) : (config.workRecords ?? true) && stats?.workRecords ? (
              <AnimatedItem><StatCard
                title={t('workRecords')}
                value={stats.workRecords.count}
                subtitle={`₹${stats.workRecords.total?.toLocaleString()} work`}
                icon={<WorkIcon />}
                href="/work-records"
                gradient="from-teal-500 to-cyan-600"
              /></AnimatedItem>
            ) : null}
          </AnimatedStagger>

          {/* Full-time days worked stats (current month) */}
          {(config.fullTimeDaysWorked ?? true) && stats?.fullTimeDaysWorked && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link
                href="/employees"
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 p-5 text-white shadow-lg transition hover:shadow-xl"
              >
                <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
                <p className="relative text-sm font-medium opacity-90">{t('daysWorked')} — {t('recorded')}</p>
                <p className="relative mt-1 text-2xl font-bold tracking-tight">
                  {stats.fullTimeDaysWorked.recorded}
                </p>
                <p className="relative mt-1 text-xs opacity-90">
                  / {stats.fullTimeDaysWorked.totalFullTime} {t('fullTime')}
                </p>
              </Link>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 p-5 text-white shadow-lg">
                <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
                <p className="relative text-sm font-medium opacity-90">{t('avgDaysWorked')}</p>
                <p className="relative mt-1 text-2xl font-bold tracking-tight">
                  {stats.fullTimeDaysWorked.avgDaysWorked ?? '—'}
                </p>
                <p className="relative mt-1 text-xs opacity-90">{t('currentMonth')}</p>
              </div>
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-green-600 p-5 text-white shadow-lg">
                <div className="absolute -right-4 -top-4 h-20 w-20 rounded-full bg-white/10" />
                <p className="relative text-sm font-medium opacity-90">{t('fullAttendance')}</p>
                <p className="relative mt-1 text-2xl font-bold tracking-tight">
                  {stats.fullTimeDaysWorked.fullAttendance}
                </p>
                <p className="relative mt-1 text-xs opacity-90">{t('fullTime')} {t('employees')}</p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Production - Style Orders & Completion */}
      {(isAdmin || isHR) && (config.styleOrders ?? true) && stats?.styleOrders && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">{t('production')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4">
            {isAdmin && (
              <StatCard
                title={t('styleOrders')}
                value={stats.styleOrders.count}
                subtitle={`₹${stats.styleOrders.workAmountWithStyle?.toLocaleString()} work`}
                icon={<WorkIcon />}
                href="/style-orders"
                gradient="from-cyan-500 to-blue-600"
              />
            )}
            {stats.styleOrders.byStyle && stats.styleOrders.byStyle.length > 0 && (
              <>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-xl">
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                  <p className="relative text-sm font-medium opacity-90">{t('overallCompletion')}</p>
                  <p className="relative mt-1 text-2xl font-bold tracking-tight">
                    {stats.styleOrders.overallCompletion ?? 0}%
                  </p>
                  <p className="relative mt-1 text-xs opacity-90">
                    {stats.styleOrders.totalProduced?.toLocaleString()} / {stats.styleOrders.totalOrderQty?.toLocaleString()} {t('produced')}
                  </p>
                </div>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white shadow-xl">
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                  <p className="relative text-sm font-medium opacity-90">{t('estimatedRemaining')}</p>
                  <p className="relative mt-1 text-2xl font-bold tracking-tight">
                    {(stats.styleOrders.estimatedRemaining ?? 0).toLocaleString()}
                  </p>
                  <p className="relative mt-1 text-xs opacity-90">{t('unitsToComplete')}</p>
                  {stats.styleOrders.estCompletionDays != null && stats.styleOrders.estCompletionDays > 0 && (
                    <p className="relative mt-2 text-xs font-medium opacity-95">{t('estCompletionDays')}: ~{stats.styleOrders.estCompletionDays}</p>
                  )}
                </div>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-6 text-white shadow-xl">
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                  <p className="relative text-sm font-medium opacity-90">{t('completed')}</p>
                  <p className="relative mt-1 text-2xl font-bold tracking-tight">
                    {stats.styleOrders.completedCount ?? 0}
                  </p>
                  <p className="relative mt-1 text-xs opacity-90">{t('styles')}</p>
                </div>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-pink-600 p-6 text-white shadow-xl">
                  <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
                  <p className="relative text-sm font-medium opacity-90">{t('needAttention')}</p>
                  <p className="relative mt-1 text-2xl font-bold tracking-tight">
                    {stats.styleOrders.behindCount ?? 0}
                  </p>
                  <p className="relative mt-1 text-xs opacity-90">{t('styles')}</p>
                </div>
              </>
            )}
          </div>

          {(config.styleSuggestions ?? true) && stats.styleOrders.suggestions && stats.styleOrders.suggestions.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="font-semibold text-slate-800">{t('suggestions')} & {t('insights')}</h3>
              <ul className="mt-3 space-y-2">
                {stats.styleOrders.suggestions.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                    <span className="mt-1 shrink-0 text-uff-accent">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(config.styleWiseChart ?? true) && stats.styleOrders.byStyle && stats.styleOrders.byStyle.length > 0 && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 bg-gradient-to-r from-cyan-50 to-white px-6 py-4">
                  <h3 className="font-semibold text-slate-800">{t('styleWiseProduction')}</h3>
                  <p className="text-sm text-slate-600">{t('currentMonth')} — Order vs Produced</p>
                </div>
                <div className="p-6">
                  <StyleWiseProductionChart data={stats.styleOrders.byStyle} />
                </div>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                <div className="border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white px-6 py-4">
                  <h3 className="font-semibold text-slate-800">{t('styleCompletion')}</h3>
                  <p className="text-sm text-slate-600">{t('currentMonth')} — {t('completionPercent')}</p>
                </div>
                <div className="p-6">
                  <StyleCompletionChart data={stats.styleOrders.byStyle} />
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Overview - Finance */}
      {isFinance && (config.payments ?? true) && stats?.payments && (
        <section className="mb-8">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">{t('overview')}</h2>
          <AnimatedStagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatedItem><StatCard
            title={t('totalPaid')}
            value={`₹${stats.payments.totalPaid?.toLocaleString()}`}
            subtitle={`${stats.payments.count} payments`}
            icon={<PaymentIcon />}
            href="/payments"
            gradient="from-emerald-500 to-teal-600"
          /></AnimatedItem>
          <AnimatedItem><StatCard
            title={t('totalPayable')}
            value={`₹${stats.payments.totalPayable?.toLocaleString()}`}
            icon={<AmountIcon />}
            href="/payments"
            gradient="from-amber-500 to-orange-600"
          /></AnimatedItem>
          <AnimatedItem><StatCard
            title={t('remainingDue')}
            value={`₹${stats.payments.totalRemaining?.toLocaleString()}`}
            subtitle={t('outstanding')}
            icon={<DueIcon />}
            href="/payments"
            gradient="from-rose-500 to-pink-600"
          /></AnimatedItem>
          <AnimatedItem><StatCard
            title={t('paymentCount')}
            value={stats.payments.count}
            subtitle={`${t('last')} ${range} ${range === '1' ? t('month') : t('months') || 'months'}`}
            icon={<CountIcon />}
            href="/payments"
            gradient="from-blue-500 to-indigo-600"
          /></AnimatedItem>
          </AnimatedStagger>
        </section>
      )}

      {/* Charts - Analytics */}
      {((isFinance && ((config.paymentTrend ?? true) || (config.paymentMode ?? true))) ||
        (isHR && ((config.workTrend ?? true) || (config.employeeType ?? true))) ||
        (isEmployee && (config.myStats ?? true))) && (
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">{t('analytics')}</h2>
        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
        {isFinance && (config.paymentTrend ?? true) && stats?.payments?.trend && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 bg-gradient-to-r from-uff-surface to-white px-6 py-4">
              <h3 className="font-semibold text-slate-800">{t('paymentTrend')}</h3>
              <p className="text-sm text-slate-700">{t('last')} {range} {range === '1' ? t('month') : t('months') || 'months'}</p>
            </div>
            <div className="p-6">
              {stats.payments.trend.length > 0 ? (
                <PaymentsTrendChart data={stats.payments.trend} />
              ) : (
                <div className="flex h-64 items-center justify-center text-slate-600">{t('noData')}</div>
              )}
            </div>
          </div>
        )}

        {isHR && (config.workTrend ?? true) && stats?.workRecords?.trend && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h3 className="font-semibold text-slate-900">{t('workTrend')}</h3>
              <p className="text-sm text-slate-700">{t('last')} {range} {range === '1' ? t('month') : t('months') || 'months'}</p>
            </div>
            <div className="p-6">
              {stats.workRecords.trend.length > 0 ? (
                <WorkTrendChart data={stats.workRecords.trend} />
              ) : (
                <div className="flex h-64 items-center justify-center text-slate-600">{t('noData')}</div>
              )}
            </div>
          </div>
        )}

        {isFinance && (config.paymentMode ?? true) && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <h3 className="font-semibold text-slate-900">{t('paymentsByMode')}</h3>
            </div>
            <div className="p-6">
              {paymentModeData.length > 0 ? (
                <PaymentModeChart data={paymentModeData} />
              ) : (
                <div className="flex h-56 items-center justify-center text-slate-600">{t('noData')}</div>
              )}
            </div>
          </div>
        )}

        {isHR && (config.employeeType ?? true) && stats?.employees && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 bg-gradient-to-r from-uff-surface to-white px-6 py-4">
              <h3 className="font-semibold text-slate-800">{t('employeesByType')}</h3>
            </div>
            <div className="p-6">
              <EmployeeTypeChart
                contractors={stats.employees.contractors}
                fullTime={stats.employees.fullTime}
              />
            </div>
          </div>
        )}

        {isEmployee && (config.myStats ?? true) && stats?.myStats?.workTrend && stats.myStats.workTrend.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 bg-gradient-to-r from-uff-surface to-white px-6 py-4">
              <h3 className="font-semibold text-slate-800">{t('myWorkTrend')}</h3>
              <p className="text-sm text-slate-700">{t('last')} {range} {range === '1' ? t('month') : t('months') || 'months'}</p>
            </div>
            <div className="p-6">
              <WorkTrendChart data={stats.myStats.workTrend} />
            </div>
          </div>
        )}

        {isEmployee && (config.myStats ?? true) && stats?.myStats?.paymentTrend && stats.myStats.paymentTrend.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
            <div className="border-b border-slate-100 bg-gradient-to-r from-uff-surface to-white px-6 py-4">
              <h3 className="font-semibold text-slate-800">{t('myPaymentTrend')}</h3>
              <p className="text-sm text-slate-700">{t('last')} {range} {range === '1' ? t('month') : t('months') || 'months'}</p>
            </div>
            <div className="p-6">
              <PaymentsTrendChart data={stats.myStats.paymentTrend} />
            </div>
          </div>
        )}
        </div>
      </section>
      )}

      {!stats?.employees && !stats?.payments && !stats?.workRecords && !stats?.myStats && (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-slate-800">{t('welcomeMessage')}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/profile"
              className="rounded-xl bg-uff-accent px-6 py-3 font-medium text-uff-primary shadow-lg transition hover:bg-uff-accent-hover"
            >
              {t('profile')}
            </Link>
          </div>
        </div>
      )}
      </div>
    </Animated>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function AmountIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DueIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function BranchIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function WorkIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function ContractorIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function FullTimeIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CountIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
    </svg>
  );
}
