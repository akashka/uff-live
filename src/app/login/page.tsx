'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { AppProvider, useApp } from '@/contexts/AppContext';
import UFFLogo from '@/components/UFFLogo';
import ValidatedInput from '@/components/ValidatedInput';
import { toast } from '@/lib/toast';

function LoginContent() {
  const { t } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<'password' | 'forgot' | 'reset'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('invalidCredentials'));
      toast.success(t('login'));
      router.push('/');
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('error');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('otpSent'));
      setOtpSent(true);
      setMode('reset');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('error');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || t('error'));
      toast.success(t('passwordResetSuccess'));
      setMode('password');
      setOtpSent(false);
      setOtp('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('error');
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-uff-primary via-uff-primary-light to-uff-primary p-4">
      <motion.div
        className="w-full max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <motion.div
          className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 p-8"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <div className="flex flex-col items-center mb-6">
            <span className="flex items-center justify-center w-16 h-16 rounded-xl bg-white p-2 mb-3 overflow-hidden">
              <UFFLogo size="lg" className="w-full h-full object-contain" />
            </span>
            <h1 className="text-2xl font-bold text-white text-center">{t('factoryManagement')}</h1>
            <p className="text-slate-200 text-center mt-1">{t('welcomeBack')}</p>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/20 text-red-200 text-sm">{error}</div>
          )}

          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="block text-slate-200 text-sm font-medium mb-1">{t('email')} <span className="text-red-400" aria-hidden="true">*</span></label>
                <ValidatedInput
                  type="email"
                  value={email}
                  onChange={setEmail}
                  fieldType="email"
                  variant="dark"
                  className="px-4 py-3"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-200 text-sm font-medium mb-1">{t('password')} <span className="text-red-400" aria-hidden="true">*</span></label>
                <div className="relative">
                  <ValidatedInput
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={setPassword}
                    fieldType="password"
                    variant="dark"
                    className="px-4 py-3 pr-12"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-white p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(''); setOtpSent(false); }}
                className="text-sm text-uff-accent hover:text-uff-accent-muted"
              >
                {t('forgotPassword')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-semibold transition disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {t('login')}
                  </span>
                ) : (
                  t('login')
                )}
              </button>
            </form>
          )}

          {mode === 'forgot' && !otpSent && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div>
                <label className="block text-slate-200 text-sm font-medium mb-1">{t('email')} <span className="text-red-400" aria-hidden="true">*</span></label>
                <ValidatedInput
                  type="email"
                  value={email}
                  onChange={setEmail}
                  fieldType="email"
                  variant="dark"
                  className="px-4 py-3"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-semibold transition disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {t('sendOTP')}
                  </span>
                ) : (
                  t('sendOTP')
                )}
              </button>
              <button
                type="button"
                onClick={() => { setMode('password'); setError(''); }}
                className="w-full py-2 text-sm text-slate-300 hover:text-white"
              >
                {t('backToLogin')}
              </button>
            </form>
          )}

          {mode === 'reset' && otpSent && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-slate-200 text-sm font-medium mb-1">{t('email')} <span className="text-red-400" aria-hidden="true">*</span></label>
                <ValidatedInput
                  type="email"
                  value={email}
                  onChange={() => {}}
                  fieldType="email"
                  variant="dark"
                  readOnly
                  className="px-4 py-3"
                />
              </div>
              <div>
                <label className="block text-slate-200 text-sm font-medium mb-1">{t('enterOTP')} <span className="text-red-400" aria-hidden="true">*</span></label>
                <ValidatedInput
                  type="text"
                  value={otp}
                  onChange={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
                  fieldType="otp"
                  variant="dark"
                  className="px-4 py-3"
                  maxLength={6}
                  required
                />
              </div>
              <div>
                <label className="block text-slate-200 text-sm font-medium mb-1">{t('newPassword')} <span className="text-red-400" aria-hidden="true">*</span></label>
                <ValidatedInput
                  type="password"
                  value={newPassword}
                  onChange={setNewPassword}
                  fieldType="password"
                  variant="dark"
                  className="px-4 py-3"
                  required
                />
              </div>
              <div>
                <label className="block text-slate-200 text-sm font-medium mb-1">{t('confirmPassword')} <span className="text-red-400" aria-hidden="true">*</span></label>
                <ValidatedInput
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  variant="dark"
                  placeholderHint="Must match new password"
                  validate={(v) => v === '' || (v.length >= 6 && v === newPassword)}
                  className="px-4 py-3"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-lg bg-uff-accent hover:bg-uff-accent-hover text-uff-primary font-semibold transition disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    {t('resetPassword')}
                  </span>
                ) : (
                  t('resetPassword')
                )}
              </button>
              <button
                type="button"
                onClick={() => { setMode('password'); setError(''); setOtpSent(false); }}
                className="w-full py-2 text-sm text-slate-300 hover:text-white"
              >
                {t('backToLogin')}
              </button>
            </form>
          )}
        </motion.div>

        <div className="mt-6 flex justify-center gap-4">
          <LanguageSelector />
          <FontSizeControls />
        </div>
      </motion.div>
    </div>
  );
}

function LanguageSelector() {
  const { locale, setLocale, t } = useApp();
  return (
    <div className="flex gap-2">
      {(['en', 'kn', 'hi'] as const).map((l) => (
        <button
          key={l}
          onClick={() => setLocale(l)}
          className={`px-3 py-1 rounded text-sm ${locale === l ? 'bg-uff-accent text-uff-primary' : 'bg-white/10 text-slate-300 hover:text-white'}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}

function FontSizeControls() {
  const { increaseFont, decreaseFont, t } = useApp();
  return (
    <div className="flex gap-2 items-center">
      <button
        onClick={decreaseFont}
        className="w-8 h-8 rounded bg-white/10 text-slate-300 hover:text-white flex items-center justify-center text-lg"
        title={t('decreaseFont')}
      >
        A-
      </button>
      <button
        onClick={increaseFont}
        className="w-8 h-8 rounded bg-white/10 text-slate-300 hover:text-white flex items-center justify-center text-lg"
        title={t('increaseFont')}
      >
        A+
      </button>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AppProvider>
      <LoginContent />
    </AppProvider>
  );
}
