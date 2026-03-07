'use client';

import { motion } from 'framer-motion';

interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        {children}
      </div>
    </motion.div>
  );
}
