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
  const [toast, setToast] = useState('');
  const [toastTone, setToastTone] = useState<'ok' | 'info'>('ok');

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
    } catch {
      const el = document.createElement('textarea');
      el.value = address.address;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    }
    setCopied(true);
    setToastTone('ok');
    setToast('Forwarding address copied');
    setTimeout(() => {
      setCopied(false);
      setToast('');
    }, 2200);
  }

  return (
    <div className="w-full max-w-settings mx-auto flex flex-col gap-4">
      <header>
        <h1 className="font-space font-semibold text-[21px] text-text">Settings</h1>
        <p className="text-[13px] text-dim mt-0.5">
          Account, forwarding, notifications — the essentials only
        </p>
        <Link
          href="/settings/billing"
          className="mt-2 inline-flex text-sm text-primary-lt hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          Billing &amp; usage →
        </Link>
      </header>

      <section aria-label="Email forwarding" className="bg-card border border-border rounded-2xl px-[22px] py-5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="font-space font-semibold text-[15px] m-0">Email forwarding</h2>
          {address && !loading && !error && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-success/10 border border-success/30 text-[11.5px] font-semibold text-success-lt">
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-success" />
              Working
            </span>
          )}
        </div>
        <p className="mt-2 text-[13.5px] text-muted max-w-[64ch] text-pretty">
          Forward any application confirmation to your private address and it lands in the Tracker as a draft. We parse only what you forward — we never read your inbox.
        </p>

        {loading && (
          <div className="mt-4">
            <ApplicationSkeleton />
          </div>
        )}

        {!loading && error && (
          <div className="mt-4">
            <ErrorState message={error} onRetry={load} />
          </div>
        )}

        {!loading && address && (
          <div className="mt-3.5 flex gap-2.5 flex-wrap items-stretch">
            <code
              id="forwarding-address"
              className="flex-1 min-w-[260px] flex items-center px-3.5 h-12 rounded-[11px] bg-surface border border-border font-mono text-[13.5px] text-teal overflow-auto whitespace-nowrap"
            >
              {address.address}
            </code>
            <button
              type="button"
              onClick={copyAddress}
              className={btnPrimary}
              aria-live="polite"
            >
              {copied ? 'Copied' : 'Copy address'}
            </button>
          </div>
        )}

        {!loading && address && (
          <p className="text-xs text-dim mt-2.5">
            Tip: set a filter in your mail app — from:(no-reply) subject:(application) → forward. One minute, then it&apos;s automatic.
          </p>
        )}
      </section>

      <section aria-label="Privacy and data" className="bg-card border border-border rounded-2xl px-[22px] py-5">
        <h2 className="font-space font-semibold text-[15px] m-0 mb-1.5">Privacy &amp; data</h2>
        <div className="flex gap-3.5 items-center py-3 flex-wrap">
          <span className="flex-1 min-w-[240px]">
            <span className="block text-sm font-semibold text-text">Export my data</span>
            <span className="block text-[12.5px] text-dim text-pretty">
              Everything — tracker, analyses, history — as JSON + CSV, instantly
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              setToastTone('info');
              setToast('Export is coming soon — we won’t ship a half-built download');
              setTimeout(() => setToast(''), 2800);
            }}
            className="shrink-0 min-h-11 px-3.5 rounded-[9px] border border-border bg-transparent text-muted text-[13px] font-semibold hover:border-hover-border hover:text-text active:bg-inner transition-colors"
          >
            Export
          </button>
        </div>
        <div className="flex gap-3.5 items-center py-3 border-t border-inner flex-wrap">
          <span className="flex-1 min-w-[240px]">
            <span className="block text-sm font-semibold text-error">Delete account</span>
            <span className="block text-[12.5px] text-dim text-pretty">
              Permanent, honoured within 24 h, no guilt-trip screens
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              setToastTone('info');
              setToast('Account deletion ships with the privacy API — not a fake button');
              setTimeout(() => setToast(''), 2800);
            }}
            className="shrink-0 min-h-11 px-3.5 rounded-[9px] border border-error/35 bg-transparent text-error text-[13px] font-semibold hover:border-error/50 active:bg-error/10 transition-colors"
          >
            Delete…
          </button>
        </div>
      </section>

      {toast && (
        <div
          role="status"
          className="fixed left-1/2 -translate-x-1/2 bottom-[calc(20px+env(safe-area-inset-bottom))] z-[70] flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5 text-[13.5px] font-medium text-text"
        >
          {toastTone === 'ok' ? (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4.5 12.5l5 5L19.5 7" />
            </svg>
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 8v5 M12 16.5v.01 M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z" />
            </svg>
          )}
          {toast}
        </div>
      )}
    </div>
  );
}

const btnPrimary = cn(
  'inline-flex items-center justify-center h-12 px-[18px] rounded-[11px] text-[13.5px] font-semibold shrink-0',
  'bg-primary text-white hover:bg-primary-hover transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);
