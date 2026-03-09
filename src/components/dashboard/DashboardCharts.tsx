'use client';

import React from 'react';
import { useApp } from '@/contexts/AppContext';
import { formatAmount } from '@/lib/utils';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const CHART_COLORS = ['#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];

export function PaymentsTrendChart({ data }: { data: { month: string; paid: number; count: number }[] }) {
  const { t } = useApp();
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="paymentsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
          <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(value) => [`₹${formatAmount(Number(value) || 0)}`, t('paid')]}
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
          />
          <Area type="monotone" dataKey="paid" stroke="#f59e0b" strokeWidth={2} fill="url(#paymentsGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WorkTrendChart({ data }: { data: { month: string; amount: number; count: number }[] }) {
  const { t } = useApp();
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#64748b" />
          <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
          <Tooltip
            formatter={(value) => [`₹${formatAmount(Number(value) || 0)}`, t('workAmount')]}
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="amount" fill="#10b981" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PaymentModeChart({ data }: { data: { name: string; value: number }[] }) {
  const { t } = useApp();
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [`₹${formatAmount(Number(value) || 0)}`, t('amount')]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface StyleWiseItem {
  styleCode: string;
  branchName: string;
  totalOrderQty: number;
  totalProduced: number;
  mfgCost: number;
  completionPct: number;
}

export function StyleWiseProductionChart({ data }: { data: StyleWiseItem[] }) {
  const { t } = useApp();
  const chartData = data.map((d) => ({
    name: d.styleCode,
    order: d.totalOrderQty,
    produced: d.totalProduced,
    mfgCost: d.mfgCost,
    completion: d.completionPct,
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 60, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis type="number" tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <YAxis type="category" dataKey="name" width={55} tick={{ fontSize: 10 }} stroke="#64748b" />
          <Tooltip
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
            formatter={(value, name) => {
              const v = value ?? 0;
              if (name === 'order') return [Math.round(Number(v)).toLocaleString(), t('orderQty')];
              if (name === 'produced') return [Math.round(Number(v)).toLocaleString(), t('produced')];
              if (name === 'mfgCost') return [`₹${formatAmount(Number(v) || 0)}`, t('manufacturingCost')];
              return [v, name ?? ''];
            }}
          />
          <Bar dataKey="order" fill="#94a3b8" radius={[0, 4, 4, 0]} name="order" />
          <Bar dataKey="produced" fill="#10b981" radius={[0, 4, 4, 0]} name="produced" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StyleCompletionChart({ data }: { data: StyleWiseItem[] }) {
  const { t } = useApp();
  const chartData = data.map((d) => ({
    name: d.styleCode,
    completion: Math.min(d.completionPct, 100),
    over: Math.max(0, d.completionPct - 100),
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#64748b" />
          <YAxis tick={{ fontSize: 11 }} stroke="#64748b" tickFormatter={(v) => `${v}%`} domain={[0, 120]} />
          <Tooltip
            formatter={(value, name) => {
              const v = value ?? 0;
              if (name === 'completion') return [`${v}%`, t('completion')];
              if (name === 'over') return [`+${v}%`, t('overTarget')];
              return [v, name ?? ''];
            }}
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }}
          />
          <Bar dataKey="completion" fill="#10b981" radius={[6, 6, 0, 0]} name="completion" stackId="a" />
          <Bar dataKey="over" fill="#3b82f6" radius={[6, 6, 0, 0]} name="over" stackId="a" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function EmployeeTypeChart({ contractors, fullTime }: { contractors: number; fullTime: number }) {
  const { t } = useApp();
  const data = [
    { name: t('contractors'), value: contractors, color: '#f59e0b' },
    { name: t('fullTime'), value: fullTime, color: '#3b82f6' },
  ].filter((d) => d.value > 0);

  if (data.length === 0) data.push({ name: t('noData'), value: 1, color: '#94a3b8' });

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={75}
            paddingAngle={2}
            dataKey="value"
            label={({ name, value }) => `${name}: ${value}`}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [value ?? 0, t('employees')]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
