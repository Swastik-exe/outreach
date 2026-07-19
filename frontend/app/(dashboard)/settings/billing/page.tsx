'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { charmPrice, planLabel } from '@/lib/billing';
import type { SubscriptionInfoResponse } from '@/lib/types';
import { ApplicationSkeleton } from '@/components/tracker/ApplicationSkeleton';
import { ErrorState } from '@/components/tracker/TrackerStates';
import { cn } from '@/lib/utils';

function usageBarColor(pct: number, atLimit: boolean): string {
  if (atLimit) return 'bg-amber';
  if (pct >= 80) return 'bg-primary-hover';
  if (pct >= 50) return 'bg-teal';
  return 'bg-primary-hover';
}

export default function BillingSettingsPage() {
  const [info, setInfo] = useState<SubscriptionInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<SubscriptionInfoResponse>('/subscription');
    if (!res.success || !res.data) {
      setError(res.error ?? 'Could not load billing info.');
      setLoading(false);
      return;
    }
    setInfo(res.data);
    setLoading(false);
  }, []);

  const cancelSubscription = useCallback(async () => {
    const ok = window.confirm(
      'Cancel your subscription? You keep full access until the end of the period you already paid for — no further charges after that.',
    );
    if (!ok) return;
    setCancelling(true);
    setNotice(null);
    const res = await api.post<SubscriptionInfoResponse>('/subscription/cancel');
    setCancelling(false);
    if (!res.success || !res.data) {
      setNotice(res.error ?? 'Could not cancel right now. Please try again.');
      return;
    }
    setInfo(res.data);
    setNotice('Subscription cancelled. You keep access until your paid period ends.');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="w-full max-w-score mx-auto flex flex-col gap-4">
        <ApplicationSkeleton />
        <ApplicationSkeleton />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="w-full max-w-score mx-auto">
        <ErrorState message={error ?? 'Unable to load billing.'} onRetry={load} />
      </div>
    );
  }

  const isActive = !info.expired && info.status === 'active';
  const subline = [
    planLabel(info.planTier),
    info.seasonPass ? 'season pass' : 'monthly',
    info.periodEnd && (info.expired ? `expired ${fmtDate(info.periodEnd)}` : `renews ${fmtDate(info.periodEnd)}`),
  ].filter(Boolean).join(' · ');

  return (
    <div className="w-full max-w-score mx-auto flex flex-col gap-4">
      <header>
        <Link
          href="/settings"
          className="text-sm text-dim hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          ← Settings
        </Link>
        <h1 className="mt-3 font-space font-semibold text-[21px] text-text">Billing &amp; usage</h1>
        <p className="text-[13px] text-dim mt-0.5">{subline}</p>
      </header>

      {notice && (
        <div
          role="status"
          className="rounded-xl border border-border bg-surface px-4 py-3 text-[13px] text-muted"
        >
          {notice}
        </div>
      )}

      {/* Current plan */}
      <section
        aria-label="Current plan"
        className="bg-card border border-border rounded-2xl px-[22px] py-5 flex gap-4 items-center flex-wrap"
      >
        <span className="shrink-0 w-11 h-11 rounded-[13px] bg-primary/16 flex items-center justify-center">
          <Image src="/assets/logo-purple.svg" alt="" width={24} height={24} />
        </span>
        <div className="flex-1 min-w-[220px]">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-space font-semibold text-[17px]">{planLabel(info.planTier)}</span>
            <span
              className={cn(
                'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold border',
                isActive
                  ? 'bg-success/10 border-success/30 text-success-lt'
                  : 'bg-amber/10 border-amber/30 text-amber',
              )}
            >
              {info.expired ? 'Expired' : info.status === 'active' ? 'Active' : info.status}
            </span>
          </div>
          <div className="text-[13px] text-muted mt-0.5">
            {info.amountInr != null && info.amountInr > 0 && (
              <span className="font-mono">{charmPrice(info.amountInr)}</span>
            )}
            {info.amountInr != null && info.amountInr > 0 && '/month'}
            {info.periodEnd && (
              <> · {info.expired ? 'ended' : 'next charge'} {fmtDate(info.periodEnd)}</>
            )}
          </div>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <Link
            href="/pricing"
            className="inline-flex items-center h-[42px] px-4 rounded-[10px] border border-border bg-surface text-text text-[13.5px] font-semibold hover:border-hover-border transition-colors"
          >
            Change plan
          </Link>
          {(info.planTier === 'free' || info.expired || info.seasonPass || info.status !== 'active') ? null : (
            <button
              type="button"
              onClick={cancelSubscription}
              disabled={cancelling}
              className="h-[42px] px-3.5 rounded-[10px] border border-border bg-surface text-muted text-[13.5px] font-medium hover:border-hover-border hover:text-text transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {cancelling ? 'Cancelling…' : 'Cancel plan'}
            </button>
          )}
        </div>
        {(info.planTier === 'free' || info.expired) && (
          <Link
            href="/pricing"
            className="w-full sm:w-auto inline-flex items-center justify-center min-h-[44px] px-4 rounded-[10px] text-sm font-semibold bg-primary text-white hover:bg-primary-hover"
          >
            Upgrade plan
          </Link>
        )}
      </section>

      {/* Usage */}
      <section aria-label="Usage" className="bg-card border border-border rounded-2xl px-[22px] py-5">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h2 className="font-space font-semibold text-[15px] m-0">This cycle</h2>
          {info.usage[0]?.resetsAt && (
            <span className="ml-auto text-[12.5px] text-dim">
              Resets {fmtDate(info.usage[0].resetsAt)}
            </span>
          )}
        </div>
        {info.usage.length === 0 ? (
          <p className="text-sm text-muted mt-4">No usage recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-4 mt-4">
            {info.usage.map((m) => {
              const pct = m.limit > 0 ? Math.min(100, (m.used / m.limit) * 100) : 0;
              const atLimit = m.limit > 0 && m.used >= m.limit;
              return (
                <div key={m.metric}>
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <span className="text-[13.5px] font-semibold text-text capitalize">
                      {m.metric.replace(/_/g, ' ')}
                    </span>
                    <span className="ml-auto font-mono text-[12.5px] text-muted tabular-nums">
                      {m.used} / {m.limit > 0 ? m.limit : '—'}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-sm bg-inner overflow-hidden mt-1.5">
                    <div
                      className={cn('h-full rounded-sm transition-all', usageBarColor(pct, atLimit))}
                      style={{ width: `${pct}%` }}
                      role="progressbar"
                      aria-valuenow={m.used}
                      aria-valuemin={0}
                      aria-valuemax={m.limit || 100}
                    />
                  </div>
                  <div className="text-xs text-dim mt-1">
                    Resets {fmtDate(m.resetsAt)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Coming soon — not available yet */}
      <section aria-label="Coming soon" className="bg-card border border-border rounded-2xl px-[22px] py-5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="font-space font-semibold text-[15px] m-0">Per-JD resume match</h2>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-inner border border-border text-[11.5px] font-semibold text-dim">
            Coming soon
          </span>
        </div>
        <p className="mt-2.5 mb-0 text-[13.5px] text-muted text-pretty">
          Paste a job description and see keyword overlap suggestions. Not available yet — this is not a paid unlock today.
        </p>
      </section>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
