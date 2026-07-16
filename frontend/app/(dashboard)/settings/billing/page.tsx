'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api } from '@/lib/api';
import { DEFAULT_PRICING, charmPrice, planLabel } from '@/lib/billing';
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
          {(info.planTier === 'free' || info.expired) ? null : (
            <button
              type="button"
              className="h-[42px] px-3.5 rounded-[10px] border-none bg-transparent text-muted text-[13.5px] font-medium hover:text-text hover:bg-card transition-colors"
            >
              Cancel — two taps, no hoops
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
              const unlimited = m.limit <= 0 || m.limit >= 999;
              return (
                <div key={m.metric}>
                  <div className="flex items-baseline gap-2.5 flex-wrap">
                    <span className="text-[13.5px] font-semibold text-text capitalize">
                      {m.metric.replace(/_/g, ' ')}
                    </span>
                    <span className="ml-auto font-mono text-[12.5px] text-muted tabular-nums">
                      {m.used}{unlimited ? ' this cycle' : ` / ${m.limit}`}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-sm bg-inner overflow-hidden mt-1.5">
                    <div
                      className={cn('h-full rounded-sm transition-all', usageBarColor(pct, atLimit))}
                      style={{ width: unlimited ? `${Math.min(100, m.used * 3)}%` : `${pct}%` }}
                      role="progressbar"
                      aria-valuenow={m.used}
                      aria-valuemin={0}
                      aria-valuemax={m.limit || 100}
                    />
                  </div>
                  <div className="text-xs text-dim mt-1">
                    {unlimited
                      ? 'Unlimited on your plan — the bar is just your pace, not a cap.'
                      : `Resets ${fmtDate(m.resetsAt)}`}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Locked Pro preview */}
      <section aria-label="Locked feature preview" className="bg-card border border-border rounded-2xl px-[22px] py-5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h2 className="font-space font-semibold text-[15px] m-0">In Pro: per-JD resume match</h2>
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber/10 border border-amber/30 text-[11.5px] font-semibold text-amber">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 10V8a6 6 0 1 1 12 0v2 M5 10h14v10H5Z" />
            </svg>
            Pro
          </span>
        </div>
        <div className="relative mt-3.5 rounded-xl overflow-hidden border border-inner">
          <div aria-hidden="true" className="blur-[7px] opacity-55 p-4 flex flex-col gap-2.5 bg-surface">
            <div className="flex gap-2.5 items-center">
              <span className="font-mono text-[22px] font-bold text-teal">86%</span>
              <span className="text-[13px] text-muted">match · Acme Corp Software Engineer JD</span>
            </div>
            <div className="h-2 rounded bg-inner">
              <span className="block h-full w-[86%] rounded bg-teal" />
            </div>
            <div className="text-[13px] text-muted">Missing: Kubernetes, gRPC · Strong: Java, Spring Boot, MySQL, Docker…</div>
            <div className="text-[13px] text-muted">Suggested bullet rewrite for &quot;built REST APIs&quot;…</div>
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 bg-bg/55">
            <div className="text-[13.5px] font-semibold text-text text-center max-w-[40ch] px-3.5">
              Paste any job description, see how closely you match and what to fix — before you apply.
            </div>
            <Link
              href="/pricing"
              className="inline-flex items-center h-10 px-4 rounded-[10px] bg-amber text-[#1A1000] text-[13px] font-bold hover:bg-[#FBBF24] active:brightness-95 transition-colors"
            >
              See Pro · {charmPrice(DEFAULT_PRICING.monthly.amountInr)}/mo
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}
