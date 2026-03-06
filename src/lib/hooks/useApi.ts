'use client';

import useSWR, { mutate as globalMutate } from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Revalidate cache for a given tag - call after mutations */
export function revalidate(key: string) {
  return globalMutate(key);
}

/** Employees list - cached 60s, deduped. Use limit=0 for all (e.g. dropdowns). */
export function useEmployees(includeInactive = false, options?: { page?: number; limit?: number; search?: string }) {
  const params = new URLSearchParams();
  params.set('includeInactive', String(includeInactive));
  if (options?.page) params.set('page', String(options.page));
  if (options?.limit !== undefined) params.set('limit', String(options.limit));
  if (options?.search) params.set('search', options.search);
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
export function usePayments(employeeId?: string, paymentRun?: string, enabled = true, options?: { page?: number; limit?: number }) {
  const params = new URLSearchParams();
  if (employeeId) params.set('employeeId', employeeId);
  if (paymentRun) params.set('paymentRun', paymentRun);
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

/** Work records - paginated */
export function useWorkRecords(params?: { employeeId?: string; periodStart?: string; periodEnd?: string; page?: number; limit?: number }, enabled = true) {
  const search = new URLSearchParams();
  if (params?.employeeId) search.set('employeeId', params.employeeId);
  if (params?.periodStart) search.set('periodStart', params.periodStart);
  if (params?.periodEnd) search.set('periodEnd', params.periodEnd);
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
