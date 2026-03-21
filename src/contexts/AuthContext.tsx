'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { UserRole } from '@/lib/models/User';

interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  employeeId?: string;
  employeeType?: 'contractor' | 'full_time';
  displayName?: string;
  photo?: string;
  branchIds?: string[];
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  setUser: (u: AuthUser | null) => void;
  refetchUser: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) setUser(data.user);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const refetchUser = useCallback(async () => {
    const res = await fetch('/api/auth/me');
    const data = await res.json();
    if (data?.user) setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    fetch('/api/auth/logout', { method: 'POST' }).finally(() => {
      setUser(null);
      window.location.href = '/login';
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refetchUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
