'use client';

import useSWR, { mutate as globalMutate } from 'swr';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

/** Revalidate cache for a given tag - call after mutations */
export function revalidate(key: string) {
  return globalMutate(key);
}

/** Employees list - cached 60s, deduped */
export function useEmployees(includeInactive = false) {
  const key = `/api/employees?includeInactive=${includeInactive}`;
  const { data, error, isLoading, mutate } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60_000,
    revalidateIfStale: true,
  });
  return {
    employees: Array.isArray(data) ? data : [],
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

/** Payments list */
export function usePayments(employeeId?: string, paymentRun?: string, enabled = true) {
  const params = new URLSearchParams();
  if (employeeId) params.set('employeeId', employeeId);
  if (paymentRun) params.set('paymentRun', paymentRun);
  const key = `/api/payments${params.toString() ? `?${params}` : ''}`;
  const { data, error, isLoading, mutate } = useSWR(enabled ? key : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });
  return {
    payments: Array.isArray(data) ? data : [],
    error,
    loading: isLoading,
    mutate,
  };
}

/** Work records */
export function useWorkRecords(params?: { employeeId?: string; periodStart?: string; periodEnd?: string }, enabled = true) {
  const search = new URLSearchParams();
  if (params?.employeeId) search.set('employeeId', params.employeeId);
  if (params?.periodStart) search.set('periodStart', params.periodStart);
  if (params?.periodEnd) search.set('periodEnd', params.periodEnd);
  const key = `/api/work-records?${search.toString() || 'all'}`;
  const { data, error, isLoading, mutate } = useSWR(enabled ? key : null, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 15_000,
  });
  return {
    records: Array.isArray(data) ? data : [],
    error,
    loading: isLoading,
    mutate,
  };
}

/** Users list */
export function useUsers() {
  const { data, error, isLoading, mutate } = useSWR('/api/users', fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });
  return {
    users: Array.isArray(data) ? data : [],
    error,
    loading: isLoading,
    mutate,
  };
}
