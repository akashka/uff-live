'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import { useEmployees, useBranches } from '@/lib/hooks/useApi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { formatMonth } from '@/lib/utils';
import { toast } from '@/lib/toast';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

type TabId = 'pdf' | 'analytics' | 'branch' | 'productivity' | 'yoy';

interface AnalyticsSummary {
  totalOrderQuantity: number;
  totalProducedQuantity: number;
  totalManufacturingCost: number;
  totalSellingPrice: number;
  totalProfitLoss: number;
}

interface AnalyticsRow {
  styleCode: string;
  branch: { name: string };
  month: string;
  rateName: string;
  totalOrderQuantity: number;
  totalProducedQuantity: number;
  sellingPricePerQuantity: number;
  totalSellingPrice: number;
  manufacturingCost: number;
  profitLoss: number;
}

const TABS: { id: TabId; label: string; icon: string; color: string }[] = [
  { id: 'pdf', label: 'PDF Reports', icon: '📄', color: 'from-amber-500 to-orange-600' },
  { id: 'analytics', label: 'Style Analytics', icon: '📊', color: 'from-emerald-500 to-teal-600' },
  { id: 'branch', label: 'Branch Comparison', icon: '🏢', color: 'from-blue-500 to-indigo-600' },
  { id: 'productivity', label: 'Employee Productivity', icon: '👥', color: 'from-violet-500 to-purple-600' },
  { id: 'yoy', label: 'Year-over-Year', icon: '📈', color: 'from-rose-500 to-pink-600' },
];

export default function ReportsPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;
  const [activeTab, setActiveTab] = useState<TabId>(() => (tabParam && TABS.some((tab) => tab.id === tabParam) ? tabParam : 'pdf'));

  const [pdfMonth, setPdfMonth] = useState(getCurrentMonth());
  const [payslipEmployeeId, setPayslipEmployeeId] = useState('');

  const [analyticsBranchId, setAnalyticsBranchId] = useState('');
  const [analyticsMonth, setAnalyticsMonth] = useState(getCurrentMonth());
  const [analyticsData, setAnalyticsData] = useState<{ data: AnalyticsRow[]; summary: AnalyticsSummary } | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const [branchCompYear, setBranchCompYear] = useState(new Date().getFullYear());
  const [branchCompData, setBranchCompData] = useState<{
    data: { branchName: string; workAmount: number; paymentAmount: number }[];
    totals: { workAmount: number; paymentAmount: number };
  } | null>(null);
  const [branchCompLoading, setBranchCompLoading] = useState(false);

  const [prodEmployeeId, setProdEmployeeId] = useState('');
  const [prodBranchId, setProdBranchId] = useState('');
  const [prodMonthFrom, setProdMonthFrom] = useState('');
  const [prodMonthTo, setProdMonthTo] = useState('');
  const [prodData, setProdData] = useState<{ data: { employeeName: string; total: number; months: { month: string; amount: number }[] }[] } | null>(null);
  const [prodLoading, setProdLoading] = useState(false);

  const [yoyYear, setYoyYear] = useState(new Date().getFullYear());
  const [yoyData, setYoyData] = useState<{
    data: { monthLabel: string; currentYear: { payments: number; workAmount: number }; previousYear: { payments: number; workAmount: number } }[];
    summary: { paymentChangePct: number | null; workChangePct: number | null };
  } | null>(null);
  const [yoyLoading, setYoyLoading] = useState(false);

  const canAccess = ['admin', 'finance', 'hr'].includes(user?.role || '');
  const isAdmin = user?.role === 'admin';
  const { employees } = useEmployees(false, { limit: 10000 });
  const { branches } = useBranches(true);

  useEffect(() => {
    if (tabParam && TABS.some((tab) => tab.id === tabParam)) setActiveTab(tabParam);
  }, [tabParam]);

  const fetchAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const params = new URLSearchParams();
      if (analyticsBranchId) params.set('branchId', analyticsBranchId);
      if (analyticsMonth) params.set('month', analyticsMonth);
      const res = await fetch(`/api/style-orders/analytics?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setAnalyticsData(json);
    } catch (e) {
      setAnalyticsData(null);
      toast.error(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setAnalyticsLoading(false);
    }
  }, [analyticsBranchId, analyticsMonth]);

  useEffect(() => {
    if (!canAccess) return;
    setBranchCompLoading(true);
    fetch(`/api/reports/branch-comparison?year=${branchCompYear}&monthFrom=${branchCompYear}-01&monthTo=${branchCompYear}-12`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setBranchCompData(d); })
      .catch(() => toast.error(t('error')))
      .finally(() => setBranchCompLoading(false));
  }, [canAccess, branchCompYear]);

  useEffect(() => {
    if (!canAccess) return;
    setProdLoading(true);
    const params = new URLSearchParams();
    if (prodEmployeeId) params.set('employeeId', prodEmployeeId);
    if (prodBranchId) params.set('branchId', prodBranchId);
    if (prodMonthFrom) params.set('monthFrom', prodMonthFrom);
    if (prodMonthTo) params.set('monthTo', prodMonthTo);
    fetch(`/api/reports/employee-productivity?${params}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setProdData(d); })
      .catch(() => toast.error(t('error')))
      .finally(() => setProdLoading(false));
  }, [canAccess, prodEmployeeId, prodBranchId, prodMonthFrom, prodMonthTo]);

  useEffect(() => {
    if (!canAccess) return;
    setYoyLoading(true);
    fetch(`/api/reports/year-over-year?year=${yoyYear}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) throw new Error(d.error); setYoyData(d); })
      .catch(() => toast.error(t('error')))
      .finally(() => setYoyLoading(false));
  }, [canAccess, yoyYear]);

  useEffect(() => {
    if (canAccess && activeTab === 'analytics') fetchAnalytics();
  }, [canAccess, activeTab, fetchAnalytics]);

  useEffect(() => {
    if (Array.isArray(branches) && branches.length === 1 && !analyticsBranchId) setAnalyticsBranchId(branches[0]._id);
  }, [branches, analyticsBranchId]);

  if (!canAccess) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-800">
        {t('accessDenied')}
      </div>
    );
  }

  const downloadPayslip = () => {
    if (!payslipEmployeeId) { toast.error(t('selectEmployee')); return; }
    window.open(`/api/reports/payslip/${payslipEmployeeId}?month=${pdfMonth}`, '_blank');
  };

  const exportAnalyticsExcel = () => {
    const params = new URLSearchParams({ format: 'excel' });
    if (analyticsBranchId) params.set('branchId', analyticsBranchId);
    if (analyticsMonth) params.set('month', analyticsMonth);
    window.open(`/api/style-orders/analytics?${params}`, '_blank');
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t('reports')} />

      {/* Tab navigation */}
      <div className="flex flex-wrap gap-2 rounded-xl bg-white p-2 shadow-sm border border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? `bg-gradient-to-r ${tab.color} text-white shadow-md`
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'pdf' && (
          <motion.section
            key="pdf"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>📄</span> {t('pdfReports')}
              </h2>
              <p className="text-amber-100 text-sm mt-0.5">Download payslips, payment summaries, and monthly reports</p>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('selectMonth')}</label>
                  <input type="month" value={pdfMonth} onChange={(e) => setPdfMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('selectEmployee')} ({t('payslip')})</label>
                  <select value={payslipEmployeeId} onChange={(e) => setPayslipEmployeeId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg min-w-[200px] focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500">
                    <option value="">—</option>
                    {(employees || []).map((e: { _id: string; name: string }) => <option key={e._id} value={e._id}>{e.name}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={downloadPayslip} className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-medium shadow-sm transition">
                    {t('downloadPayslip')}
                  </button>
                  <button onClick={() => window.open(`/api/reports/payment-summary?month=${pdfMonth}`, '_blank')} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium transition">
                    {t('downloadPaymentSummary')}
                  </button>
                  <button onClick={() => window.open(`/api/reports/monthly?month=${pdfMonth}`, '_blank')} className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium transition">
                    {t('downloadMonthlyReport')}
                  </button>
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {activeTab === 'analytics' && (
          <motion.section
            key="analytics"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span>📊</span> {t('styleOrders')} {t('analytics')}
                </h2>
                <p className="text-emerald-100 text-sm mt-0.5">Production, completion, and profit/loss by style</p>
              </div>
              <button onClick={exportAnalyticsExcel} disabled={!analyticsData} className="px-4 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-white font-medium disabled:opacity-50 transition">
                {t('export')} Excel
              </button>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-4 items-end mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('branches')}</label>
                  <select value={analyticsBranchId} onChange={(e) => setAnalyticsBranchId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500">
                    <option value="">{t('all')} {t('branches')}</option>
                    {(branches || []).map((b: { _id: string; name: string }) => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('month')}</label>
                  <input type="month" value={analyticsMonth} onChange={(e) => setAnalyticsMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500" />
                </div>
                <button onClick={fetchAnalytics} disabled={analyticsLoading} className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-medium disabled:opacity-50">
                  {analyticsLoading ? t('loading') : t('fetchAnalytics')}
                </button>
              </div>

              {analyticsLoading && <div className="h-48 animate-pulse bg-slate-100 rounded-xl" />}
              {!analyticsLoading && analyticsData && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-6">
                    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                      <p className="text-sm text-emerald-700">{t('orderQty')}</p>
                      <p className="text-xl font-bold text-emerald-900">{analyticsData.summary.totalOrderQuantity.toLocaleString()}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-teal-50 border border-teal-100">
                      <p className="text-sm text-teal-700">{t('totalProduced')}</p>
                      <p className="text-xl font-bold text-teal-900">{analyticsData.summary.totalProducedQuantity.toLocaleString()}</p>
                    </div>
                    {isAdmin && (
                      <>
                        <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
                          <p className="text-sm text-blue-700">{t('manufacturingCost')}</p>
                          <p className="text-xl font-bold text-blue-900">₹{analyticsData.summary.totalManufacturingCost.toLocaleString()}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                          <p className="text-sm text-indigo-700">{t('sellingPrice')}</p>
                          <p className="text-xl font-bold text-indigo-900">₹{analyticsData.summary.totalSellingPrice.toLocaleString()}</p>
                        </div>
                        <div className={`p-4 rounded-xl border ${analyticsData.summary.totalProfitLoss >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                          <p className="text-sm text-slate-700">{t('profitLoss')}</p>
                          <p className={`text-xl font-bold ${analyticsData.summary.totalProfitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>₹{analyticsData.summary.totalProfitLoss.toLocaleString()}</p>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('styleOrderCode')}</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('branches')}</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('month')}</th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('rateName')}</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('orderQty')}</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('produced')}</th>
                          {isAdmin && (
                            <>
                              <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('manufacturingCost')}</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('sellingPrice')}</th>
                              <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('profitLoss')}</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {analyticsData.data.length === 0 ? (
                          <tr><td colSpan={isAdmin ? 9 : 6} className="px-4 py-8 text-center text-slate-600">{t('noData')}</td></tr>
                        ) : (
                          analyticsData.data.map((r) => (
                            <tr key={r.styleCode + r.month + r.rateName + (r.branch?.name || '')} className="hover:bg-slate-50">
                              <td className="px-4 py-3 text-slate-800 font-medium">{r.styleCode}</td>
                              <td className="px-4 py-3 text-slate-700">{r.branch?.name || '-'}</td>
                              <td className="px-4 py-3 text-slate-700">{formatMonth(r.month)}</td>
                              <td className="px-4 py-3 text-slate-700">{r.rateName}</td>
                              <td className="px-4 py-3 text-right">{r.totalOrderQuantity.toLocaleString()}</td>
                              <td className="px-4 py-3 text-right">{r.totalProducedQuantity.toLocaleString()}</td>
                              {isAdmin && (
                                <>
                                  <td className="px-4 py-3 text-right">₹{r.manufacturingCost.toLocaleString()}</td>
                                  <td className="px-4 py-3 text-right">₹{r.totalSellingPrice.toLocaleString()}</td>
                                  <td className={`px-4 py-3 text-right font-medium ${r.profitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>₹{r.profitLoss.toLocaleString()}</td>
                                </>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </motion.section>
        )}

        {activeTab === 'branch' && (
          <motion.section
            key="branch"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>🏢</span> {t('branchComparison')}
              </h2>
              <p className="text-blue-100 text-sm mt-0.5">Compare productivity and payments across branches</p>
            </div>
            <div className="p-6">
              <div className="flex gap-4 items-end mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('selectYear')}</label>
                  <select value={branchCompYear} onChange={(e) => setBranchCompYear(parseInt(e.target.value, 10))} className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500">
                    {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              {branchCompLoading ? (
                <div className="h-72 animate-pulse bg-slate-100 rounded-xl" />
              ) : branchCompData?.data?.length ? (
                <>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 mb-6">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('branches')}</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('workAmount')}</th>
                          <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('payments')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {branchCompData.data.map((row) => (
                          <tr key={row.branchName} className="hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-800 font-medium">{row.branchName}</td>
                            <td className="px-4 py-3 text-right">₹{row.workAmount.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-right">₹{row.paymentAmount.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 font-semibold">
                        <tr>
                          <td className="px-4 py-3">{t('all')}</td>
                          <td className="px-4 py-3 text-right">₹{(branchCompData.totals?.workAmount ?? 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right">₹{(branchCompData.totals?.paymentAmount ?? 0).toLocaleString('en-IN')}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={branchCompData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="branchName" />
                        <YAxis />
                        <Tooltip formatter={(v: number | undefined) => (v != null ? `₹${v.toLocaleString('en-IN')}` : '')} />
                        <Legend />
                        <Bar dataKey="workAmount" name={t('workAmount')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="paymentAmount" name={t('payments')} fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className="text-slate-600 py-8 text-center">{t('noData')}</p>
              )}
            </div>
          </motion.section>
        )}

        {activeTab === 'productivity' && (
          <motion.section
            key="productivity"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>👥</span> {t('employeeProductivity')}
              </h2>
              <p className="text-violet-100 text-sm mt-0.5">Output per employee over time with filters</p>
            </div>
            <div className="p-6">
              <div className="flex flex-wrap gap-4 items-end mb-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('selectEmployee')}</label>
                  <select value={prodEmployeeId} onChange={(e) => setProdEmployeeId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg min-w-[180px] focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500">
                    <option value="">{t('all')}</option>
                    {(employees || []).map((e: { _id: string; name: string }) => <option key={e._id} value={e._id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('selectBranch')}</label>
                  <select value={prodBranchId} onChange={(e) => setProdBranchId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg min-w-[180px] focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500">
                    <option value="">{t('all')}</option>
                    {(branches || []).map((b: { _id: string; name: string }) => <option key={b._id} value={b._id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('fromMonth')}</label>
                  <input type="month" value={prodMonthFrom} onChange={(e) => setProdMonthFrom(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('toMonth')}</label>
                  <input type="month" value={prodMonthTo} onChange={(e) => setProdMonthTo(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500" />
                </div>
              </div>
              {prodLoading ? (
                <div className="h-48 animate-pulse bg-slate-100 rounded-xl" />
              ) : prodData?.data?.length ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-violet-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('employeeName')}</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-slate-800">{t('totalAmount')}</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-slate-800">{t('month')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {prodData.data.flatMap((row) =>
                        row.months.map((m) => (
                          <tr key={`${row.employeeName}-${m.month}`} className="hover:bg-slate-50">
                            <td className="px-4 py-2 text-slate-800 font-medium">{row.employeeName}</td>
                            <td className="px-4 py-2 text-right">₹{m.amount.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-2 text-slate-600">{m.month}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-600 py-8 text-center">{t('noData')}</p>
              )}
            </div>
          </motion.section>
        )}

        {activeTab === 'yoy' && (
          <motion.section
            key="yoy"
            initial={{ opacity: 0, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="rounded-2xl bg-white shadow-lg border border-slate-200 overflow-hidden"
          >
            <div className="bg-gradient-to-r from-rose-500 to-pink-600 px-6 py-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span>📈</span> {t('yearOverYear')}
              </h2>
              <p className="text-rose-100 text-sm mt-0.5">Compare current vs previous year for planning</p>
            </div>
            <div className="p-6">
              <div className="flex gap-4 items-end mb-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('selectYear')}</label>
                  <select value={yoyYear} onChange={(e) => setYoyYear(parseInt(e.target.value, 10))} className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-rose-500/30 focus:border-rose-500">
                    {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              {yoyData?.summary && (
                <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-rose-50 to-pink-50 border border-rose-100 flex flex-wrap gap-6">
                  {yoyData.summary.paymentChangePct != null && (
                    <span className="flex items-center gap-2">
                      <span className="text-slate-600">{t('payments')} {yoyYear} vs {yoyYear - 1}:</span>
                      <strong className={yoyData.summary.paymentChangePct >= 0 ? 'text-green-700' : 'text-red-700'}>
                        {yoyData.summary.paymentChangePct >= 0 ? '+' : ''}{yoyData.summary.paymentChangePct.toFixed(1)}%
                      </strong>
                    </span>
                  )}
                  {yoyData.summary.workChangePct != null && (
                    <span className="flex items-center gap-2">
                      <span className="text-slate-600">{t('workAmount')} {yoyYear} vs {yoyYear - 1}:</span>
                      <strong className={yoyData.summary.workChangePct >= 0 ? 'text-green-700' : 'text-red-700'}>
                        {yoyData.summary.workChangePct >= 0 ? '+' : ''}{yoyData.summary.workChangePct.toFixed(1)}%
                      </strong>
                    </span>
                  )}
                </div>
              )}
              {yoyLoading ? (
                <div className="h-72 animate-pulse bg-slate-100 rounded-xl" />
              ) : yoyData?.data?.length ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yoyData.data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="monthLabel" />
                      <YAxis />
                      <Tooltip formatter={(v: number | undefined) => (v != null ? `₹${v.toLocaleString('en-IN')}` : '')} />
                      <Legend />
                      <Bar dataKey="currentYear.payments" name={`${yoyYear} ${t('payments')}`} fill="#f43f5e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="previousYear.payments" name={`${yoyYear - 1} ${t('payments')}`} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="currentYear.workAmount" name={`${yoyYear} ${t('workAmount')}`} fill="#ec4899" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="previousYear.workAmount" name={`${yoyYear - 1} ${t('workAmount')}`} fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-slate-600 py-8 text-center">{t('noData')}</p>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}
