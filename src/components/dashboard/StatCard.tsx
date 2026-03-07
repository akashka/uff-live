'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  href?: string;
  gradient?: string;
}

export default function StatCard({ title, value, subtitle, icon, trend, href, gradient = 'from-uff-accent to-uff-accent-hover' }: StatCardProps) {
  const content = (
    <motion.div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${gradient} p-6 text-white shadow-xl transition-shadow duration-300 hover:shadow-2xl`}
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/10" />
      <div className="absolute -bottom-2 -right-2 h-16 w-16 rounded-full bg-white/5" />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium opacity-90">{title}</span>
          <span className="rounded-lg bg-white/20 p-2">{icon}</span>
        </div>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {subtitle && <p className="mt-1 text-sm opacity-90">{subtitle}</p>}
        {trend && (
          <p className={`mt-2 text-sm font-medium ${trend.value >= 0 ? 'text-emerald-200' : 'text-rose-200'}`}>
            {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
          </p>
        )}
      </div>
    </motion.div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}
