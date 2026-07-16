'use client';

import { Suspense, useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { VortexLoader } from '@/components/VortexLoader';
import {
  AuthShell,
  authInputClass,
  authLabelClass,
  authPrimaryBtnClass,
} from '@/components/AuthShell';

function VerifyForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const emailParam = searchParams.get('email') ?? '';
  const [email, setEmail] = useState(emailParam);
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);
  const autoVerifyRan = useRef(false);

  const verifyToken = useCallback(
    async (rawToken: string) => {
      const trimmed = rawToken.trim();
      if (!trimmed) return;
      setStatus('loading');
      setErrorMsg('');
      const res = await api.post('/auth/verify-email', { token: trimmed });
      if (res.success) {
        setStatus('success');
        setTimeout(() => router.push('/login?verified=1'), 2000);
      } else {
        setStatus('error');
        setErrorMsg(res.error ?? 'Verification failed');
      }
    },
    [router],
  );

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken && !autoVerifyRan.current) {
      autoVerifyRan.current = true;
      setToken(urlToken);
      verifyToken(urlToken);
    }
  }, [searchParams, verifyToken]);

  useEffect(() => {
    if (emailParam) setEmail(emailParam);
  }, [emailParam]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await verifyToken(token);
  };

  async function handleResend(e: FormEvent) {
    e.preventDefault();
    setResendMsg('');
    setResending(true);
    const res = await api.post('/auth/resend-verification', { email: email.trim() });
    setResending(false);
    if (res.success) {
      setResendMsg('Sent — check spam too.');
    } else {
      setResendMsg(res.error ?? 'Could not resend. Try again.');
    }
  }

  return (
    <AuthShell>
      {status === 'success' ? (
        <div className="flex flex-col items-center text-center">
          <h1 className="m-0 font-space font-semibold text-[19px]">Email verified</h1>
          <p className="m-0 mt-1.5 text-[13.5px] text-muted">Redirecting to sign in…</p>
        </div>
      ) : status === 'loading' && token ? (
        <div className="flex flex-col items-center text-center py-4">
          <VortexLoader size="lg" label="Verifying your email…" />
        </div>
      ) : (
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
            {email ? (
              <>
                We sent a verification link to{' '}
                <span className="text-text font-semibold">{email}</span>. Open it, or paste the
                token below.
              </>
            ) : (
              <>Open the link in your email, or paste the verification token below.</>
            )}
          </p>

          <form onSubmit={handleSubmit} className="w-full mt-5 flex flex-col gap-3 text-left">
            {status === 'error' && (
              <div
                role="alert"
                className="rounded-[10px] bg-[rgba(251,113,133,0.10)] border border-[rgba(251,113,133,0.28)] px-3.5 py-3 text-[13.5px] text-error"
              >
                {errorMsg}
              </div>
            )}

            <label>
              <span className={authLabelClass}>Verification token</span>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className={`${authInputClass} font-mono`}
                placeholder="Paste your verification token"
              />
            </label>

            <button
              type="submit"
              disabled={status === 'loading'}
              className={authPrimaryBtnClass}
            >
              {status === 'loading' ? 'Verifying…' : 'Verify and continue'}
            </button>
          </form>

          <form onSubmit={handleResend} className="w-full mt-4 text-left">
            <p className="text-[13px] text-dim mb-2">
              Didn&apos;t get it?{' '}
              <button
                type="submit"
                disabled={resending}
                className="border-none bg-transparent text-primary-lt font-semibold text-[13px] cursor-pointer p-0 hover:text-[#C4B5FD] disabled:opacity-50"
              >
                {resending ? 'Sending…' : resendMsg || 'Resend'}
              </button>
            </p>
            {!emailParam && (
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={authInputClass}
              />
            )}
            {resendMsg && resendMsg !== 'Sent — check spam too.' && (
              <p className="text-xs text-dim mt-2">{resendMsg}</p>
            )}
          </form>

          <Link
            href="/login"
            className="mt-3 text-[12.5px] text-dim hover:text-muted no-underline"
          >
            Wrong address? Back to sign in
          </Link>
        </div>
      )}
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
