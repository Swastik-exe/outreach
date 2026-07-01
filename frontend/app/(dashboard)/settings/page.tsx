'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { ForwardingAddressResponse } from '@/lib/types';
import { ApplicationSkeleton } from '@/components/tracker/ApplicationSkeleton';
import { ErrorState } from '@/components/tracker/TrackerStates';
import { cn } from '@/lib/utils';

export default function SettingsPage() {
  const [address, setAddress] = useState<ForwardingAddressResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<ForwardingAddressResponse>('/settings/forwarding');
    if (!res.success || !res.data) {
      setError(res.error ?? 'Could not load your forwarding address.');
      setLoading(false);
      return;
    }
    setAddress(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function copyAddress() {
    if (!address?.address) return;
    try {
      await navigator.clipboard.writeText(address.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = address.address;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold font-space text-text">Settings</h1>
        <p className="text-sm text-muted mt-1">
          Your personal tools for keeping the tracker up to date effortlessly.
        </p>
        <Link
          href="/settings/billing"
          className="mt-3 inline-flex text-sm text-primary-lt hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          Billing & usage →
        </Link>
      </header>

      <section className="rounded-xl border border-border bg-surface p-4 sm:p-6">
        <h2 className="font-medium text-text">Email forwarding</h2>
        <p className="text-sm text-muted mt-2">
          Forward application confirmation emails here to auto-add them as drafts —
          review and confirm before they join your tracker.
        </p>

        {loading && (
          <div className="mt-4">
            <ApplicationSkeleton />
          </div>
        )}

        {!loading && error && <div className="mt-4"><ErrorState message={error} onRetry={load} /></div>}

        {!loading && address && (
          <div className="mt-4">
            <label htmlFor="forwarding-address" className="text-xs text-muted">
              Your unique forwarding address
            </label>
            <div className="mt-2 flex flex-col sm:flex-row gap-2">
              <input
                id="forwarding-address"
                readOnly
                value={address.address}
                className={cn(
                  'flex-1 min-h-[44px] rounded-lg border border-border bg-bg px-3 py-2',
                  'text-sm font-mono text-text select-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                )}
                aria-describedby="forwarding-help"
              />
              <button
                type="button"
                onClick={copyAddress}
                className={btnPrimary}
                aria-live="polite"
              >
                {copied ? 'Copied!' : 'Copy address'}
              </button>
            </div>
            <p id="forwarding-help" className="text-xs text-muted mt-2">
              Add this as a forwarding destination in your email client or set up Cloudflare Email Routing.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

const btnPrimary = cn(
  'inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium shrink-0',
  'bg-primary text-white hover:bg-primary-lt transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);
