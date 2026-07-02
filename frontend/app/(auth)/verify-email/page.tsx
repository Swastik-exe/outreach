'use client';

import { Suspense, useState, useEffect, useRef, useCallback, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

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

  const verifyToken = useCallback(async (rawToken: string) => {
    const trimmed = rawToken.trim();
    if (!trimmed) return;
    setStatus('loading');
    setErrorMsg('');
    const res = await api.post('/auth/verify-email', { token: trimmed });
    if (res.success) {
      setStatus('success');
      setTimeout(() => router.push('/login'), 2000);
    } else {
      setStatus('error');
      setErrorMsg(res.error ?? 'Verification failed');
    }
  }, [router]);

  // Auto-verify when user clicks the link in their email (token in URL).
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
      setResendMsg('If that email is registered and unverified, we sent a new link. Check your inbox and spam folder.');
    } else {
      setResendMsg(res.error ?? 'Could not resend. Try again.');
    }
  }

  return (
    <main className="min-h-screen bg-[#0A0B0E] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-tight text-white">
            out<span className="text-indigo-400">reach</span>
          </span>
          <p className="text-[#8B8FA8] text-sm mt-2">Verify your email</p>
        </div>

        {status === 'success' ? (
          <div className="text-center bg-[#111318] border border-[#2A2D36] rounded-xl p-6">
            <div className="text-3xl mb-3">✅</div>
            <p className="text-[#F4F5F7] font-medium">Email verified!</p>
            <p className="text-[#8B8FA8] text-sm mt-1">Redirecting to login…</p>
          </div>
        ) : status === 'loading' && token ? (
          <div className="text-center bg-[#111318] border border-[#2A2D36] rounded-xl p-6">
            <p className="text-[#F4F5F7] font-medium">Verifying your email…</p>
            <p className="text-[#8B8FA8] text-sm mt-1">This only takes a moment.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-[#111318] border border-[#2A2D36] rounded-xl p-6 space-y-4">
            {status === 'error' && (
              <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {errorMsg}
              </div>
            )}
            <div className="space-y-1.5">
              <label htmlFor="token" className="block text-sm font-medium text-[#F4F5F7]">
                Verification token
              </label>
              <input
                id="token"
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                className="w-full rounded-lg bg-[#1A1D24] border border-[#2A2D36] px-3 py-2.5 text-sm text-[#F4F5F7] placeholder-[#4B4F63] focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono min-h-[44px]"
                placeholder="Paste your verification token"
              />
              <p className="text-xs text-[#4B4F63]">
                Open the link in your email, or paste the token here.
              </p>
            </div>
            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-sm transition-colors min-h-[44px]"
            >
              {status === 'loading' ? 'Verifying…' : 'Verify email'}
            </button>
          </form>
        )}

        <form onSubmit={handleResend} className="mt-4 bg-[#111318] border border-[#2A2D36] rounded-xl p-4 space-y-3">
          <p className="text-xs text-[#8B8FA8]">Didn&apos;t get the email?</p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full rounded-lg bg-[#1A1D24] border border-[#2A2D36] px-3 py-2 text-sm text-[#F4F5F7] min-h-[44px]"
          />
          <button
            type="submit"
            disabled={resending}
            className="w-full py-2 text-sm text-indigo-400 hover:text-indigo-300 disabled:opacity-50"
          >
            {resending ? 'Sending…' : 'Resend verification email'}
          </button>
          {resendMsg && <p className="text-xs text-[#8B8FA8]">{resendMsg}</p>}
        </form>

        <p className="text-center text-sm text-[#8B8FA8] mt-4">
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 transition-colors">
            ← Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}
