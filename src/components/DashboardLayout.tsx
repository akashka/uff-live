'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { useApp } from '@/contexts/AppContext';
import { useUnreadNotificationCount } from '@/lib/hooks/useApi';
import UFFLogo from '@/components/UFFLogo';
import UserAvatar from '@/components/UserAvatar';

const iconClass = 'w-5 h-5 shrink-0';

function HomeIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function NotificationsIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function BranchesIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function EmployeesIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function WorkRecordsIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  );
}

function PaymentsIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function PassbookIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function RatesIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    </svg>
  );
}

function StyleOrderIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
    </svg>
  );
}

function VendorsIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}

function AnalyticsIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function AuditLogIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function MasterIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  );
}

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, locale, setLocale, increaseFont, decreaseFont } = useApp();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const unreadCount = useUnreadNotificationCount();

  const canAccessBranches = user?.role === 'admin';
  const canAccessUsers = user?.role === 'admin';
  const canAccessSystem = user?.role === 'admin';
  const canAccessEmployees = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '');
  const canAccessRates = user?.role === 'admin';
  const canAccessStyleOrders = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '');
  const canAccessWorkRecords = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '');
  const canAccessVendors = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '');
  const canAccessPayments = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '');
  const canAccessAnalytics = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '');
  const canAccessReports = ['admin', 'finance', 'accountancy', 'hr'].includes(user?.role || '');
  const isEmployee = !!user?.employeeId;
  const isContractorEmployee = isEmployee && user?.employeeType === 'contractor';

  const hasPayments = canAccessPayments || isEmployee;

  const canAccessMaster = canAccessBranches || canAccessEmployees || canAccessRates || canAccessStyleOrders || canAccessVendors;
  const masterNavItem = canAccessMaster
    ? {
        label: t('master'),
        icon: <MasterIcon />,
        children: [
          ...(canAccessBranches ? [{ href: '/branches', label: t('branches') }] : []),
          ...(canAccessEmployees ? [{ href: '/employees', label: t('employees') }] : []),
          ...(canAccessVendors ? [{ href: '/vendors', label: t('jobworkVendors') }] : []),
          ...(canAccessRates ? [{ href: '/rates', label: t('rateMaster') }] : []),
          ...(canAccessStyleOrders ? [{ href: '/style-orders', label: t('styleOrders') }] : []),
        ].filter((c) => c.href && c.label) as { href: string; label: string }[],
      }
    : null;

  const workRecordsNavItem =
    canAccessWorkRecords || canAccessVendors
      ? {
          label: t('workRecords'),
          icon: <WorkRecordsIcon />,
          children: [
            ...(canAccessWorkRecords ? [{ href: '/work-records', label: t('employees') }] : []),
            ...(canAccessVendors ? [{ href: '/vendor-work-orders', label: t('vendor') }] : []),
          ].filter((c) => c.href && c.label) as { href: string; label: string }[],
        }
      : isContractorEmployee
        ? { href: '/work-records', label: t('workRecords'), icon: <WorkRecordsIcon /> }
        : null;

  const paymentsNavItem = (canAccessPayments || isEmployee)
    ? {
        label: t('payments'),
        icon: <PaymentsIcon />,
        href: '/payments',
      }
    : null;

  const profileNavItem = {
    label: t('profile'),
    icon: <ProfileIcon />,
    children: [
      { href: '/profile', label: t('myProfile') },
      ...(canAccessUsers ? [{ href: '/users', label: t('users') }] : []),
    ].filter((c) => c.href && c.label) as { href: string; label: string }[],
  };

  const navItems: { href?: string; label: string; icon: React.ReactNode; children?: { href: string; label: string }[]; badge?: number }[] = [
    { href: '/', label: t('home'), icon: <HomeIcon /> },
    { href: '/notifications', label: t('notifications'), icon: <NotificationsIcon />, badge: unreadCount },
    profileNavItem,
    ...(masterNavItem && masterNavItem.children && masterNavItem.children.length > 0 ? [masterNavItem] : []),
    ...(workRecordsNavItem ? [workRecordsNavItem] : []),
    ...(paymentsNavItem ? [paymentsNavItem] : []),
    ...(canAccessReports ? [{ href: '/reports', label: t('reports'), icon: <ReportsIcon /> }] : []),
    ...(isEmployee && user?.employeeId ? [{ href: `/employees/${user.employeeId}/passbook`, label: t('passbook'), icon: <PassbookIcon /> }] : []),
    ...(canAccessSystem ? [{ href: '/system', label: t('systemAndAudit') || 'System & Audit', icon: <SystemIcon /> }] : []),
  ];

  const navContent = (
    <>
      {navItems.map((item, idx) => {
        if (item.children && item.children.length > 0) {
          return (
            <div key={`${item.label}-${idx}`} className="space-y-0.5">
              <div className="flex items-center gap-3 px-4 py-2.5 text-slate-300 text-sm font-medium">
                {item.icon}
                <span>{item.label}</span>
              </div>
              {item.children.map((child) => {
                const [childPath, childQueryStr] = child.href.split('?');
                const childQuery = childQueryStr ? Object.fromEntries(new URLSearchParams(childQueryStr)) : {};
                const isActive =
                  pathname === childPath &&
                  (Object.keys(childQuery).length === 0
                    ? true
                    : searchParams && Object.entries(childQuery).every(([k, v]) => searchParams.get(k) === v));
                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 pl-11 pr-4 py-2.5 rounded-lg transition text-sm ${
                      isActive
                        ? 'bg-uff-accent text-uff-primary font-medium'
                        : 'text-slate-200 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <span>{child.label}</span>
                  </Link>
                );
              })}
            </div>
          );
        }
        const href = item.href!;
        const isPassbook = href.includes('/passbook');
        const isAnalytics = href.includes('/analytics');
        const isPayments = href === '/payments';
        const isActive = isPassbook
          ? pathname.includes('/passbook') && pathname.startsWith('/employees/')
          : isAnalytics
            ? pathname.startsWith('/style-orders/analytics')
            : isPayments
              ? pathname.startsWith('/payments')
              : pathname === href;
        const badge = 'badge' in item ? (item as { badge?: number }).badge : undefined;
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
              isActive
                ? 'bg-uff-accent text-uff-primary font-medium'
                : 'text-slate-200 hover:bg-white/10 hover:text-white'
            }`}
          >
            {item.icon}
            <span className="flex-1 min-w-0">{item.label}</span>
            {badge != null && badge > 0 && (
              <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-semibold flex items-center justify-center">
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </Link>
        );
      })}
    </>
  );

  const logoutButton = (
    <button
      onClick={() => {
        logout();
        setSidebarOpen(false);
      }}
      className="flex w-full items-center gap-3 px-4 py-3 rounded-lg transition text-slate-300 hover:bg-red-500/20 hover:text-red-200"
    >
      <LogoutIcon />
      <span>{t('logout')}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-uff-surface flex flex-col">
      {/* White header - full width, top */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm w-full">
        <div className="px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between w-full">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 shrink-0"
              aria-label="Open menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-uff-primary overflow-hidden shrink-0">
                <UFFLogo size="sm" className="w-6 h-6 object-contain" />
              </span>
              <span className="font-semibold text-slate-800 truncate">{t('factoryManagement')}</span>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden sm:flex gap-1">
                <button
                  onClick={decreaseFont}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 text-sm"
                  title={t('decreaseFont')}
                >
                  A-
                </button>
                <button
                  onClick={increaseFont}
                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-600 text-sm"
                  title={t('increaseFont')}
                >
                  A+
                </button>
              </div>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as 'en' | 'kn' | 'hi')}
                className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 bg-white"
              >
                <option value="en">EN</option>
                <option value="kn">KN</option>
                <option value="hi">HI</option>
              </select>
              <span className="px-2 py-1 rounded bg-slate-200 text-slate-800 text-xs font-medium hidden sm:inline">
                {user?.role ? t(user.role as 'admin' | 'finance' | 'accountancy' | 'hr' | 'employee') : ''}
              </span>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full hover:ring-2 hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-uff-accent"
                title={t('profile')}
              >
                <UserAvatar
                  photo={user?.photo}
                  name={user?.displayName}
                  email={user?.email}
                  size="md"
                />
              </Link>
          </div>
        </div>
      </header>

      {/* Sidebar overlay - mobile */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            className="lg:hidden fixed inset-0 bg-black/50 z-40 top-14"
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar - mobile drawer (below header) */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            className="lg:hidden fixed left-0 top-14 bottom-0 w-60 bg-uff-primary text-white z-50 flex flex-col"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
        <div className="p-4 flex items-center justify-end border-b border-white/10">
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded-lg hover:bg-white/10"
            aria-label="Close menu"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navContent}
        </nav>
        <div className="border-t border-white/10 p-3 shrink-0">
          {logoutButton}
        </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Content area: fixed sidebar + main */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar - desktop, fixed below header, does not scroll */}
        <aside className="hidden lg:flex flex-col fixed left-0 top-14 bottom-0 w-60 bg-uff-primary text-white border-r border-white/10 z-20">
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
            {navContent}
          </nav>
          <div className="border-t border-white/10 p-3 shrink-0">
            {logoutButton}
          </div>
        </aside>

        {/* Main content - offset by sidebar width, scrollable */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 lg:pl-60 overflow-y-auto">
          <motion.main
            className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.main>

          <footer className="border-t border-slate-200 bg-white py-4 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-600">
                <Link href="/about" className="hover:text-uff-accent">{t('aboutUs')}</Link>
                <Link href="/contact" className="hover:text-uff-accent">{t('contactUs')}</Link>
                <Link href="/faq" className="hover:text-uff-accent">{t('faq')}</Link>
                <Link href="/privacy" className="hover:text-uff-accent">{t('privacyPolicy')}</Link>
                <Link href="/terms" className="hover:text-uff-accent">{t('termsAndConditions')}</Link>
              </div>
              <p className="text-center text-slate-600 text-xs mt-2">
                © {new Date().getFullYear()} URBAN FASHION FACTORY (UFF)
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}
