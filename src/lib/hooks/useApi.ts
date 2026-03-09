'use client';

import useSWR, { mutate as globalMutate } from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Revalidate cache for a given tag - call after mutations */
export function revalidate(key: string) {
  return globalMutate(key);
}

/** Employees list - cached 60s, deduped. Use limit=0 for all (e.g. dropdowns). */
export function useEmployees(includeInactive = false, options?: { page?: number; limit?: number; search?: string; departmentId?: string; branchId?: string }) {
  const params = new URLSearchParams();
  params.set('includeInactive', String(includeInactive));
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  if (options?.search) params.set('search', options.search);
  if (options?.departmentId) params.set('departmentId', options.departmentId);
  if (options?.branchId) params.set('branchId', options.branchId);
  const key = `/api/employees?${params.toString()}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    revalidateIfStale: true,
  });
  const employees = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  return {
    employees,
    total: data?.total ?? employees.length,
    page: data?.page ?? 1,
    limit: data?.limit ?? 50,
    hasMore: data?.hasMore ?? false,
    error,
    loading: isLoading,
    mutate,
  };
}

/** Branches list - cached 60s */
export function useBranches(includeInactive = false) {
  const key = `/api/branches?includeInactive=${includeInactive}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  return {
    branches: Array.isArray(data) ? data : [],
    error,
    loading: isLoading,
    mutate,
  };
}

/** Departments list - cached 60s */
export function useDepartments(includeInactive = false) {
  const key = `/api/departments?includeInactive=${includeInactive}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  return {
    departments: Array.isArray(data) ? data : [],
    error,
    loading: isLoading,
    mutate,
  };
}

/** Rates list - cached 60s */
export function useRates(includeInactive = false, branchId?: string) {
  let key = `/api/rates?includeInactive=${includeInactive}`;
  if (branchId) key += `&branch=${branchId}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  return {
    rates: Array.isArray(data) ? data : [],
    error,
    loading: isLoading,
    mutate,
  };
}

/** Full-time days worked by employee for a given month (from salary payments) */
export function useFullTimeDaysWorked(month: string | null) {
  const key = month ? `/api/full-time/days-worked?month=${month}` : null;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const byEmployee = (data?.byEmployee ?? {}) as Record<string, { daysWorked: number; totalWorkingDays: number }>;
  return { byEmployee, error, loading: isLoading, mutate };
}

/** Today's birthdays & anniversaries (role-filtered: admin/hr/finance see all, employee sees same-branch only) */
export function useReminders(date?: string) {
  const params = date ? `?date=${date}` : '';
  const key = `/api/reminders/birthdays-anniversaries${params}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  return {
    birthdays: (data?.birthdays ?? []) as { _id: string; name: string; dateOfBirth: string; branches?: { name: string }[] }[],
    anniversaries: (data?.anniversaries ?? []) as { _id: string; name: string; anniversaryDate: string; branches?: { name: string }[] }[],
    error,
    loading: isLoading,
    mutate,
  };
}

/** Dashboard stats */
export function useDashboardStats(range = '30') {
  const key = `/api/dashboard/stats?range=${range}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  return {
    stats: data ?? null,
    error,
    loading: isLoading,
    mutate,
  };
}

/** Profile data */
export function useProfile() {
  const { data, error, isLoading, mutate } = useSWR('/api/profile', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  return {
    data: data ?? null,
    error,
    loading: isLoading,
    mutate,
  };
}

/** Payments list - paginated */
export function usePayments(employeeId?: string, enabled = true, options?: { page?: number; limit?: number; month?: string; paymentType?: 'contractor' | 'full_time'; isAdvance?: boolean }) {
  const params = new URLSearchParams();
  if (employeeId) params.set('employeeId', employeeId);
  if (options?.month) params.set('month', options.month);
  if (options?.paymentType) params.set('paymentType', options.paymentType);
  if (options?.isAdvance !== undefined) params.set('isAdvance', String(options.isAdvance));
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  const key = `/api/payments${params.toString() ? `?${params}` : ''}`;
  const { data, error, isLoading, mutate } = useSWR(enabled ? key : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });
  const payments = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  return {
    payments,
    total: data?.total ?? payments.length,
    page: data?.page ?? 1,
    limit: data?.limit ?? 50,
    hasMore: data?.hasMore ?? false,
    error,
    loading: isLoading,
    mutate,
  };
}

/** Vendors list - cached 60s */
export function useVendors(includeInactive = false, options?: { page?: number; limit?: number; search?: string }) {
  const params = new URLSearchParams();
  params.set('includeInactive', String(includeInactive));
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  if (options?.search) params.set('search', options.search);
  const key = `/api/vendors?${params.toString()}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  const vendors = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  return {
    vendors,
    total: data?.total ?? vendors.length,
    page: data?.page ?? 1,
    limit: data?.limit ?? 50,
    hasMore: data?.hasMore ?? false,
    error,
    loading: isLoading,
    mutate,
  };
}

/** Vendor work orders - paginated */
export function useVendorWorkOrders(params?: { vendorId?: string; branchId?: string; month?: string; page?: number; limit?: number }, enabled = true) {
  const search = new URLSearchParams();
  if (params?.vendorId) search.set('vendorId', params.vendorId);
  if (params?.branchId) search.set('branchId', params.branchId);
  if (params?.month) search.set('month', params.month);
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  const key = `/api/vendor-work-orders?${search.toString() || 'all'}`;
  const { data, error, isLoading, mutate } = useSWR(enabled ? key : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });
  const records = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  return {
    records,
    total: data?.total ?? records.length,
    page: data?.page ?? 1,
    limit: data?.limit ?? 50,
    hasMore: data?.hasMore ?? false,
    error,
    loading: isLoading,
    mutate,
  };
}

/** Vendor payments - paginated */
export function useVendorPayments(vendorId?: string, enabled = true, options?: { page?: number; limit?: number; month?: string; paymentType?: 'advance' | 'monthly' }) {
  const params = new URLSearchParams();
  if (vendorId) params.set('vendorId', vendorId);
  if (options?.month) params.set('month', options.month);
  if (options?.paymentType) params.set('paymentType', options.paymentType);
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  const key = `/api/vendor-payments${params.toString() ? `?${params}` : ''}`;
  const { data, error, isLoading, mutate } = useSWR(enabled ? key : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });
  const payments = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  return {
    payments,
    total: data?.total ?? payments.length,
    page: data?.page ?? 1,
    limit: data?.limit ?? 50,
    hasMore: data?.hasMore ?? false,
    error,
    loading: isLoading,
    mutate,
  };
}

/** Work records - paginated */
export function useWorkRecords(params?: { employeeId?: string; branchId?: string; departmentId?: string; month?: string; page?: number; limit?: number }, enabled = true) {
  const search = new URLSearchParams();
  if (params?.employeeId) search.set('employeeId', params.employeeId);
  if (params?.branchId) search.set('branchId', params.branchId);
  if (params?.departmentId) search.set('departmentId', params.departmentId);
  if (params?.month) search.set('month', params.month);
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  const key = `/api/work-records?${search.toString() || 'all'}`;
  const { data, error, isLoading, mutate } = useSWR(enabled ? key : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });
  const records = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  return {
    records,
    total: data?.total ?? records.length,
    page: data?.page ?? 1,
    limit: data?.limit ?? 50,
    hasMore: data?.hasMore ?? false,
    error,
    loading: isLoading,
    mutate,
  };
}

/** Style orders list */
export function useStyleOrders(includeInactive = false, branchId?: string, month?: string) {
  const params = new URLSearchParams();
  params.set('includeInactive', String(includeInactive));
  if (branchId) params.set('branchId', branchId);
  if (month) params.set('month', month);
  const key = `/api/style-orders?${params.toString()}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
  });
  return {
    styleOrders: Array.isArray(data) ? data : [],
    error,
    loading: isLoading,
    mutate,
  };
}

/** Style orders by branch+month (with available quantities) */
export function useStyleOrdersByBranchMonth(branchId?: string, month?: string, enabled = true) {
  const params = new URLSearchParams();
  if (branchId) params.set('branchId', branchId);
  if (month) params.set('month', month);
  const key = branchId && month ? `/api/style-orders/by-branch-month?${params.toString()}` : null;
  const { data, error, isLoading, mutate } = useSWR(enabled && key ? key : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });
  return {
    styleOrders: Array.isArray(data) ? data : [],
    error,
    loading: isLoading,
    mutate,
  };
}

/** Notifications list - with polling for real-time feel */
export function useNotifications(options?: {
  unreadOnly?: boolean;
  readOnly?: boolean;
  type?: string;
  page?: number;
  limit?: number;
  refreshInterval?: number;
}) {
  const params = new URLSearchParams();
  if (options?.unreadOnly) params.set('unread', 'true');
  if (options?.readOnly) params.set('unread', 'false');
  if (options?.type) params.set('type', options.type);
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  const key = `/api/notifications${params.toString() ? `?${params}` : ''}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5_000,
    refreshInterval: options?.refreshInterval ?? 15_000,
  });
  const notifications = Array.isArray(data?.data) ? data.data : [];
  return {
    notifications,
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    limit: data?.limit ?? 50,
    hasMore: data?.hasMore ?? false,
    unreadCount: data?.unreadCount ?? 0,
    error,
    loading: isLoading,
    mutate,
  };
}

/** Unread notification count - for sidebar badge, polls every 15s */
export function useUnreadNotificationCount() {
  const { data } = useSWR('/api/notifications/unread-count', fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 5_000,
    refreshInterval: 15_000,
  });
  return data?.count ?? 0;
}

/** Users list - paginated */
export function useUsers(options?: { page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit) params.set('limit', String(options.limit));
  const key = `/api/users${params.toString() ? `?${params}` : ''}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  const users = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
  return {
    users,
    total: data?.total ?? users.length,
    page: data?.page ?? 1,
    limit: data?.limit ?? 50,
    hasMore: data?.hasMore ?? false,
    error,
    loading: isLoading,
    mutate,
  };
}
