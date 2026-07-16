'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { ForgotPasswordRequest } from '@/lib/types';
import {
  AuthShell,
  authInputClass,
  authLabelClass,
  authPrimaryBtnClass,
  authSecondaryBtnClass,
} from '@/components/AuthShell';

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
    <AuthShell>
      {status === 'sent' ? (
        <div className="flex flex-col items-center text-center">
          <span className="w-[46px] h-[46px] rounded-[13px] bg-[rgba(45,212,191,0.12)] flex items-center justify-center">
            <svg
              width="21"
              height="21"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2DD4BF"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z M3.5 7l8.5 6 8.5-6" />
            </svg>
          </span>
          <h1 className="m-0 mt-4 font-space font-semibold text-[19px]">Check your email</h1>
          <p className="m-0 mt-1 text-sm text-muted max-w-[38ch]">
            If an account exists for <span className="text-text font-semibold">{email}</span>,
            we&apos;ve sent a link to reset your password.
          </p>
          <Link
            href="/login"
            className={`${authSecondaryBtnClass} mt-5 flex items-center justify-center no-underline`}
          >
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <h1 className="m-0 font-space font-semibold text-[19px]">Reset your password</h1>
          <p className="m-0 mt-1.5 text-[13.5px] text-muted">
            Enter your email and we&apos;ll send a reset link. No stress — your data is exactly
            where you left it.
          </p>

          <form onSubmit={handleSubmit} className="mt-[18px] flex flex-col gap-3" noValidate>
            {status === 'error' && (
              <div
                role="alert"
                className="rounded-[10px] bg-[rgba(251,113,133,0.10)] border border-[rgba(251,113,133,0.28)] px-3.5 py-3 text-[13.5px] text-error"
              >
                {errorMsg}
              </div>
            )}

            <label>
              <span className={authLabelClass}>Email</span>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={authInputClass}
                placeholder="you@example.com"
              />
            </label>

            <button
              type="submit"
              disabled={status === 'loading'}
              className={authPrimaryBtnClass}
            >
              {status === 'loading' ? 'Sending…' : 'Send reset link'}
            </button>

            <Link
              href="/login"
              className={`${authSecondaryBtnClass} flex items-center justify-center no-underline`}
            >
              Back to sign in
            </Link>
          </form>
        </>
      )}
    </AuthShell>
  );
}
