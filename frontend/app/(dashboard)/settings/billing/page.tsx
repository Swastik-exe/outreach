'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { charmPrice, planLabel } from '@/lib/billing';
import type { SubscriptionInfoResponse } from '@/lib/types';
import { ApplicationSkeleton } from '@/components/tracker/ApplicationSkeleton';
import { ErrorState } from '@/components/tracker/TrackerStates';
import { cn } from '@/lib/utils';

export default function BillingSettingsPage() {
  const [info, setInfo] = useState<SubscriptionInfoResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="max-w-xl mx-auto space-y-4">
        <ApplicationSkeleton />
        <ApplicationSkeleton />
      </div>
    );
  }

  if (error || !info) {
    return (
      <div className="max-w-xl mx-auto">
        <ErrorState message={error ?? 'Unable to load billing.'} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <header>
        <Link
          href="/settings"
          className="text-sm text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          ← Settings
        </Link>
        <h1 className="mt-3 text-2xl font-bold font-space text-text">Billing & usage</h1>
        <p className="text-sm text-muted mt-1">Your plan, status, and monthly limits.</p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium text-text">Current plan</h2>
        <dl className="mt-3 grid gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Plan</dt>
            <dd className="text-text font-medium">{planLabel(info.planTier)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Status</dt>
            <dd className={cn(
              'capitalize',
              info.expired ? 'text-orange-400' : info.status === 'active' ? 'text-emerald-400' : 'text-muted',
            )}>
              {info.expired ? 'expired' : info.status}
            </dd>
          </div>
          {info.seasonPass && (
            <div className="flex justify-between">
              <dt className="text-muted">Type</dt>
              <dd className="text-text">Season Pass</dd>
            </div>
          )}
          {info.periodEnd && (
            <div className="flex justify-between">
              <dt className="text-muted">{info.expired ? 'Expired on' : 'Renews / ends'}</dt>
              <dd className="text-text">{fmtDate(info.periodEnd)}</dd>
            </div>
          )}
          {info.amountInr != null && info.amountInr > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Amount</dt>
              <dd className="text-text">{charmPrice(info.amountInr)}</dd>
            </div>
          )}
        </dl>

        {(info.planTier === 'free' || info.expired) && (
          <Link
            href="/pricing"
            className={cn(
              'mt-4 inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg',
              'text-sm font-medium bg-primary text-white hover:bg-primary-lt',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            )}
          >
            Upgrade plan
          </Link>
        )}
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium text-text">Usage this period</h2>
        {info.usage.length === 0 ? (
          <p className="text-sm text-muted mt-2">No usage recorded yet.</p>
        ) : (
          <ul className="mt-4 space-y-4">
            {info.usage.map((m) => {
              const pct = m.limit > 0 ? Math.min(100, (m.used / m.limit) * 100) : 0;
              const atLimit = m.used >= m.limit;
              return (
                <li key={m.metric}>
                  <div className="flex justify-between text-sm">
                    <span className="text-text capitalize">{m.metric.replace(/_/g, ' ')}</span>
                    <span className={cn(atLimit ? 'text-orange-400' : 'text-muted')}>
                      {m.used} / {m.limit}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-surface2 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        atLimit ? 'bg-orange-400' : 'bg-primary',
                      )}
                      style={{ width: `${pct}%` }}
                      role="progressbar"
                      aria-valuenow={m.used}
                      aria-valuemin={0}
                      aria-valuemax={m.limit}
                    />
                  </div>
                  <p className="text-xs text-muted mt-1">
                    Resets {fmtDate(m.resetsAt)}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
