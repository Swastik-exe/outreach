'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { ResetPasswordRequest } from '@/lib/types';

function ResetForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setStatus('error');
      setErrorMsg('Passwords do not match.');
      return;
    }
    if (newPassword.length < 8) {
      setStatus('error');
      setErrorMsg('Password must be at least 8 characters.');
      return;
    }

    setStatus('loading');
    setErrorMsg('');
    const res = await api.post<void>('/auth/reset-password', {
      token: token.trim(),
      newPassword,
    } satisfies ResetPasswordRequest);

    if (res.success) {
      setStatus('success');
      setTimeout(() => router.push('/login'), 2000);
    } else {
      setStatus('error');
      setErrorMsg(res.error ?? 'Could not reset password. The link may have expired.');
    }
  };

  return (
    <main className="min-h-screen bg-[#0A0B0E] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-tight text-white">
            out<span className="text-indigo-400">reach</span>
          </span>
          <p className="text-[#8B8FA8] text-sm mt-2">Choose a new password</p>
        </div>

        {status === 'success' ? (
          <div className="text-center bg-[#111318] border border-[#2A2D36] rounded-xl p-6">
            <div className="text-3xl mb-3">✅</div>
            <p className="text-[#F4F5F7] font-medium">Password reset!</p>
            <p className="text-[#8B8FA8] text-sm mt-1">Redirecting to login…</p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-[#111318] border border-[#2A2D36] rounded-xl p-6 space-y-4"
            noValidate
          >
            {status === 'error' && (
              <div
                role="alert"
                className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
              >
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="token" className="block text-sm font-medium text-[#F4F5F7]">
                Reset token
              </label>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full rounded-lg bg-[#1A1D24] border border-[#2A2D36] px-3 py-2.5 text-sm text-[#F4F5F7] placeholder-[#4B4F63] focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono min-h-[44px]"
                placeholder="Paste your reset token"
              />
              <p className="text-xs text-[#4B4F63]">
                This should be filled in automatically from the link in your email.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="newPassword" className="block text-sm font-medium text-[#F4F5F7]">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg bg-[#1A1D24] border border-[#2A2D36] px-3 py-2.5 text-sm text-[#F4F5F7] placeholder-[#4B4F63] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors min-h-[44px]"
                placeholder="Min. 8 characters"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#F4F5F7]">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg bg-[#1A1D24] border border-[#2A2D36] px-3 py-2.5 text-sm text-[#F4F5F7] placeholder-[#4B4F63] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors min-h-[44px]"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111318]"
            >
              {status === 'loading' ? 'Resetting…' : 'Reset password'}
            </button>
          </form>
        )}

        <p className="text-center text-sm text-[#8B8FA8] mt-4">
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
