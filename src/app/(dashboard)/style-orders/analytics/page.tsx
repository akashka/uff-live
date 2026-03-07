'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/contexts/AppContext';
import { useAuth } from '@/contexts/AuthContext';
import PageHeader from '@/components/PageHeader';
import { Skeleton } from '@/components/Skeleton';
import { useBranches } from '@/lib/hooks/useApi';
import { formatMonth } from '@/lib/utils';

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

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

export default function StyleOrderAnalyticsPage() {
  const { t } = useApp();
  const { user } = useAuth();
  const [branchId, setBranchId] = useState('');
  const [month, setMonth] = useState(getCurrentMonth());
  const [data, setData] = useState<{ data: AnalyticsRow[]; summary: AnalyticsSummary } | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const isAdmin = user?.role === 'admin';
  const canAccess = ['admin', 'finance', 'hr'].includes(user?.role || '') || !!user?.employeeId;
  const { branches } = useBranches(true);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setFetched(true);
    try {
      const params = new URLSearchParams();
      if (branchId) params.set('branchId', branchId);
      if (month) params.set('month', month);
      const res = await fetch(`/api/style-orders/analytics?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
    } catch (e) {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [branchId, month]);

  useEffect(() => {
    if (canAccess) fetchAnalytics();
  }, [canAccess, fetchAnalytics]);

  useEffect(() => {
    if (Array.isArray(branches) && branches.length === 1 && !branchId) {
      setBranchId(branches[0]._id);
    }
  }, [branches, branchId]);

  if (!canAccess) {
    return (
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
        <p className="text-slate-700">{t('accessDenied')}</p>
      </div>
    );
  }

  const exportToExcel = () => {
    const params = new URLSearchParams();
    params.set('format', 'excel');
    if (branchId) params.set('branchId', branchId);
    if (month) params.set('month', month);
    window.open(`/api/style-orders/analytics?${params.toString()}`, '_blank');
  };

  return (
    <div>
      <PageHeader title={`${t('styleOrders')} ${t('analytics')}`}>
        <button
          onClick={exportToExcel}
          disabled={!data}
          className="px-4 py-2 rounded-lg border border-slate-300 hover:bg-uff-surface font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('export')} Excel
        </button>
      </PageHeader>
      <div className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('branches')}</label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg">
              <option value="">{t('all')} {t('branches')}</option>
              {(Array.isArray(branches) ? branches : []).map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('month')}</label>
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg" />
          </div>
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-medium disabled:opacity-50"
          >
            {loading ? t('loading') : t('fetchAnalytics')}
          </button>
        </div>

        {loading && fetched && <Skeleton className="h-64 w-full" variant="rect" />}

        {!loading && data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="p-4 rounded-lg bg-uff-surface">
                <p className="text-sm text-slate-600">{t('totalOrderQuantity')}</p>
                <p className="text-xl font-semibold">{data.summary.totalOrderQuantity.toLocaleString()}</p>
              </div>
              <div className="p-4 rounded-lg bg-uff-surface">
                <p className="text-sm text-slate-600">{t('totalProduced')}</p>
                <p className="text-xl font-semibold">{data.summary.totalProducedQuantity.toLocaleString()}</p>
              </div>
              {isAdmin && (
                <>
                  <div className="p-4 rounded-lg bg-uff-surface">
                    <p className="text-sm text-slate-600">{t('manufacturingCost')}</p>
                    <p className="text-xl font-semibold">₹{data.summary.totalManufacturingCost.toLocaleString()}</p>
                  </div>
                  <div className="p-4 rounded-lg bg-uff-surface">
                    <p className="text-sm text-slate-600">{t('sellingPrice')}</p>
                    <p className="text-xl font-semibold">₹{data.summary.totalSellingPrice.toLocaleString()}</p>
                  </div>
                  <div className={`p-4 rounded-lg ${data.summary.totalProfitLoss >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                    <p className="text-sm text-slate-600">{t('profitLoss')}</p>
                    <p className={`text-xl font-semibold ${data.summary.totalProfitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                      ₹{data.summary.totalProfitLoss.toLocaleString()}
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-uff-surface">
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
                  {data.data.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 9 : 6} className="px-4 py-8 text-center text-slate-600">{t('noData')}</td>
                    </tr>
                  ) : (
                    data.data.map((r) => (
                      <tr key={r.styleCode + r.month + r.rateName + (r.branch?.name || '')} className="hover:bg-uff-surface">
                        <td className="px-4 py-3 text-slate-800">{r.styleCode}</td>
                        <td className="px-4 py-3 text-slate-700">{r.branch?.name || '-'}</td>
                        <td className="px-4 py-3 text-slate-700">{formatMonth(r.month)}</td>
                        <td className="px-4 py-3 text-slate-700">{r.rateName}</td>
                        <td className="px-4 py-3 text-right">{r.totalOrderQuantity.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{r.totalProducedQuantity.toLocaleString()}</td>
                        {isAdmin && (
                          <>
                            <td className="px-4 py-3 text-right">₹{r.manufacturingCost.toLocaleString()}</td>
                            <td className="px-4 py-3 text-right">₹{r.totalSellingPrice.toLocaleString()}</td>
                            <td className={`px-4 py-3 text-right font-medium ${r.profitLoss >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              ₹{r.profitLoss.toLocaleString()}
                            </td>
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

        {fetched && !loading && !data && (
          <p className="text-slate-600">{t('failedToLoad')}</p>
        )}
      </div>
    </div>
  );
}
