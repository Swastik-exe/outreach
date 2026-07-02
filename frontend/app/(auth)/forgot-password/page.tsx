'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { ForgotPasswordRequest } from '@/lib/types';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    setErrorMsg('');
    const res = await api.post<void>('/auth/forgot-password', {
      email: email.trim(),
    } satisfies ForgotPasswordRequest);
    if (res.success) {
      setStatus('sent');
    } else {
      setStatus('error');
      setErrorMsg(res.error ?? 'Something went wrong. Please try again.');
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
          <p className="text-[#8B8FA8] text-sm mt-2">Reset your password</p>
        </div>

        {status === 'sent' ? (
          <div className="text-center bg-[#111318] border border-[#2A2D36] rounded-xl p-6">
            <div className="text-3xl mb-3">📬</div>
            <p className="text-[#F4F5F7] font-medium">Check your email</p>
            <p className="text-[#8B8FA8] text-sm mt-1">
              If an account exists for <strong className="text-[#F4F5F7]">{email}</strong>,
              we&apos;ve sent a link to reset your password.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-[#111318] border border-[#2A2D36] rounded-xl p-6 space-y-4"
            noValidate
          >
            <p className="text-sm text-[#8B8FA8]">
              Enter the email address on your account and we&apos;ll send you a link to reset
              your password.
            </p>

            {status === 'error' && (
              <div
                role="alert"
                className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400"
              >
                {errorMsg}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-medium text-[#F4F5F7]">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-[#1A1D24] border border-[#2A2D36] px-3 py-2.5 text-sm text-[#F4F5F7] placeholder-[#4B4F63] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors min-h-[44px]"
                placeholder="you@college.edu"
              />
            </div>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111318]"
            >
              {status === 'loading' ? 'Sending…' : 'Send reset link'}
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
