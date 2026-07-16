'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/auth';
import {
  AuthShell,
  AuthTabs,
  AuthDivider,
  authInputClass,
  authLabelClass,
  authPrimaryBtnClass,
} from '@/components/AuthShell';

export default function RegisterPage() {
  const { register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await register({ email, password });
    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <AuthShell>
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
          <h1 className="m-0 mt-4 font-space font-semibold text-[19px]">Check your inbox</h1>
          <p className="m-0 mt-1 text-sm text-muted max-w-[38ch]" style={{ textWrap: 'pretty' }}>
            We sent a verification link to{' '}
            <span className="text-text font-semibold">{email}</span>. It expires in 24 hours.
          </p>
          <Link
            href={`/verify-email?email=${encodeURIComponent(email)}`}
            className={`${authPrimaryBtnClass} mt-5 flex items-center justify-center no-underline`}
          >
            Resend or enter token
          </Link>
          <Link
            href="/login"
            className="mt-4 text-[12.5px] text-dim hover:text-muted no-underline"
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <AuthTabs active="register" />

      <AuthDivider />

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        {error && (
          <div
            role="alert"
            className="rounded-[10px] bg-[rgba(251,113,133,0.10)] border border-[rgba(251,113,133,0.28)] px-3.5 py-3 text-[13.5px] text-error"
          >
            {error}
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

        <label>
          <span className={authLabelClass}>Password</span>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
            placeholder="At least 8 characters"
          />
        </label>

        <button type="submit" disabled={loading} className={`${authPrimaryBtnClass} mt-1`}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <div className="mt-1 text-xs text-dim text-center" style={{ textWrap: 'pretty' }}>
          Any email works · free forever plan · no card needed
        </div>
      </form>
    </AuthShell>
  );
}
