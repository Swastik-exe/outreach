'use client';

import { Suspense, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth';
import {
  AuthShell,
  AuthTabs,
  AuthDivider,
  authInputClass,
  authLabelClass,
  authPrimaryBtnClass,
} from '@/components/AuthShell';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get('verified') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login({ email, password });
    setLoading(false);
    if (result.error) {
      if (result.errorCode === 'EMAIL_NOT_VERIFIED') {
        setError(
          'Please verify your email first. Check your inbox or resend the link from the registration email.',
        );
      } else {
        setError(result.error);
      }
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <AuthShell>
      <AuthTabs active="login" />

      <AuthDivider />

      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        {verified && (
          <div
            role="status"
            className="rounded-[10px] bg-[rgba(16,185,129,0.10)] border border-[rgba(16,185,129,0.28)] px-3.5 py-3 text-[13.5px] text-success-lt"
          >
            Email verified! You can sign in now.
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-[10px] bg-[rgba(251,113,133,0.10)] border border-[rgba(251,113,133,0.28)] px-3.5 py-3 text-[13.5px] text-error"
          >
            {error}
            {error.includes('verify your email') && (
              <p className="mt-2">
                <Link
                  href={`/verify-email?email=${encodeURIComponent(email)}`}
                  className="text-primary-lt hover:text-[#C4B5FD] font-semibold"
                >
                  Resend verification email →
                </Link>
              </p>
            )}
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
          <span className={`${authLabelClass} flex items-baseline`}>
            Password
            <Link
              href="/forgot-password"
              className="ml-auto text-[12.5px] font-semibold text-primary-lt hover:text-[#C4B5FD] no-underline"
            >
              Forgot?
            </Link>
          </span>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={authInputClass}
            placeholder="Your password"
          />
        </label>

        <button type="submit" disabled={loading} className={`${authPrimaryBtnClass} mt-1`}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
