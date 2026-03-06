'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Locale } from '@/lib/translations';
import { translations } from '@/lib/translations';

interface AppContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  fontSize: number;
  increaseFont: () => void;
  decreaseFont: () => void;
  t: (key: string) => string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const MIN_FONT = 12;
const MAX_FONT = 24;
const FONT_STEP = 2;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [fontSize, setFontSize] = useState(16);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedLocale = localStorage.getItem('locale') as Locale | null;
    const savedFont = localStorage.getItem('fontSize');
    if (savedLocale && ['en', 'kn', 'hi'].includes(savedLocale)) setLocaleState(savedLocale);
    if (savedFont) setFontSize(Math.min(MAX_FONT, Math.max(MIN_FONT, parseInt(savedFont, 10))));
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('locale', locale);
      document.documentElement.style.fontSize = `${fontSize}px`;
    }
  }, [locale, fontSize, mounted]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
  }, []);

  const increaseFont = useCallback(() => {
    setFontSize((f) => {
      const next = Math.min(MAX_FONT, f + FONT_STEP);
      if (mounted) localStorage.setItem('fontSize', String(next));
      return next;
    });
  }, [mounted]);

  const decreaseFont = useCallback(() => {
    setFontSize((f) => {
      const next = Math.max(MIN_FONT, f - FONT_STEP);
      if (mounted) localStorage.setItem('fontSize', String(next));
      return next;
    });
  }, [mounted]);

  const t = useCallback(
    (key: string) => {
      return translations[locale][key] ?? key;
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, fontSize, increaseFont, decreaseFont, t }),
    [locale, setLocale, fontSize, increaseFont, decreaseFont, t]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
