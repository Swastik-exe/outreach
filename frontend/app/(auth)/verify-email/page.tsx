'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

function VerifyForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [token, setToken] = useState(searchParams.get('token') ?? '');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    const res = await api.post('/auth/verify-email', { token: token.trim() });
    if (res.success) {
      setStatus('success');
      setTimeout(() => router.push('/login'), 2000);
    } else {
      setStatus('error');
      setErrorMsg(res.error ?? 'Verification failed');
    }
  };

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
                placeholder="Paste token from email / server log"
              />
              <p className="text-xs text-[#4B4F63]">
                Check the backend logs: grep &quot;VERIFY TOKEN&quot;
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
