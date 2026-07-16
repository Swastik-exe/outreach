'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { ResetPasswordRequest } from '@/lib/types';
import {
  AuthShell,
  authInputClass,
  authLabelClass,
  authPrimaryBtnClass,
  authSecondaryBtnClass,
} from '@/components/AuthShell';

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
    <AuthShell>
      {status === 'success' ? (
        <div className="text-center">
          <h1 className="m-0 font-space font-semibold text-[19px]">Password reset</h1>
          <p className="m-0 mt-1.5 text-[13.5px] text-muted">Redirecting to sign in…</p>
        </div>
      ) : (
        <>
          <h1 className="m-0 font-space font-semibold text-[19px]">Choose a new password</h1>
          <p className="m-0 mt-1.5 text-[13.5px] text-muted">
            Pick something you&apos;ll remember. Your account and data stay exactly as they were.
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
              <span className={authLabelClass}>Reset token</span>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className={`${authInputClass} font-mono`}
                placeholder="Paste your reset token"
              />
              <p className="mt-1.5 text-xs text-dim">
                Filled automatically from the link in your email.
              </p>
            </label>

            <label>
              <span className={authLabelClass}>New password</span>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={authInputClass}
                placeholder="At least 8 characters"
              />
            </label>

            <label>
              <span className={authLabelClass}>Confirm password</span>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={authInputClass}
                placeholder="Repeat password"
              />
            </label>

            <button
              type="submit"
              disabled={status === 'loading'}
              className={authPrimaryBtnClass}
            >
              {status === 'loading' ? 'Resetting…' : 'Reset password'}
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

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
