'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { isPlatformAdmin } from '@/lib/jwt';
import { tokenStore } from '@/lib/api';
import type { AdminFeedbackItem, AdminStatsResponse, SpringPage } from '@/lib/types';
import { cn } from '@/lib/utils';
import { VortexLoader } from '@/components/VortexLoader';

type FeedbackTab = 'All' | 'Bug' | 'Idea' | 'Praise';

function kindStyle(type: string): { label: string; color: string } {
  const t = type.toLowerCase();
  if (t === 'bug') return { label: 'Bug', color: '#FB7185' };
  if (t === 'feature' || t === 'idea') return { label: 'Idea', color: '#2DD4BF' };
  if (t === 'praise') return { label: 'Praise', color: '#34D399' };
  return { label: type, color: '#A5B4C3' };
}

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export default function AdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<FeedbackTab>('All');
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  useEffect(() => {
    const token = tokenStore.get();
    if (!isPlatformAdmin(token)) {
      setAllowed(false);
      setLoading(false);
      return;
    }
    setAllowed(true);

    (async () => {
      const statsRes = await api.get<AdminStatsResponse>('/admin/stats');
      if (!statsRes.success) {
        setError(statsRes.error ?? 'Failed to load stats');
        setLoading(false);
        return;
      }
      setStats(statsRes.data ?? null);

      const fbRes = await api.get<SpringPage<AdminFeedbackItem>>('/admin/feedback?page=0&size=50');
      if (fbRes.success && fbRes.data?.content) {
        setFeedback(fbRes.data.content);
      }
      setLoading(false);
    })();
  }, []);

  const suspend = async (userId: string) => {
    if (!confirm('Suspend this user?')) return;
    const res = await api.post(`/admin/users/${userId}/suspend`, {});
    if (res.success) {
      setActionMsg(`User ${userId.slice(0, 8)}… suspended`);
    } else {
      setActionMsg(res.error ?? 'Suspend failed');
    }
  };

  const toggleResolved = (id: string) => {
    setResolved((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (allowed === false) {
    return (
      <div className="py-16 text-center">
        <h1 className="text-xl font-semibold font-space text-text mb-2">Access denied</h1>
        <p className="text-dim mb-6">Platform admin role required.</p>
        <button
          type="button"
          onClick={() => router.push('/dashboard')}
          className="min-h-[44px] px-4 rounded-[10px] bg-primary text-white hover:bg-primary-hover focus-visible:ring-2 focus-visible:ring-primary"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <VortexLoader label="Loading admin dashboard…" />
      </div>
    );
  }

  if (error) {
    return <p className="text-error py-8" role="alert">{error}</p>;
  }

  const statCards = stats
    ? [
        { n: 'AI cost today', v: `$${Number(stats.aiCostToday).toFixed(4)}`, d: 'today', dC: 'text-dim', sub: 'all models' },
        { n: 'Active users', v: String(stats.activeUsersToday), d: 'today', dC: 'text-dim', sub: 'weekly active, all plans' },
        { n: 'Revenue', v: `₹${stats.revenueThisMonthInr}`, d: 'this month', dC: 'text-dim', sub: 'gross, INR' },
        { n: 'Failed jobs', v: String(stats.failedJobs), d: stats.failedJobs > 0 ? 'attention' : 'clear', dC: stats.failedJobs > 0 ? 'text-amber' : 'text-success-lt', sub: 'last 24 h' },
        { n: 'System', v: stats.systemStatus, d: '', dC: 'text-success-lt', sub: 'overall status' },
      ]
    : [];

  const filtered = feedback.filter((f) => {
    if (tab === 'All') return true;
    const k = kindStyle(f.type);
    return k.label === tab;
  });

  const unresolved = feedback.filter((f) => !resolved.has(f.id)).length;

  return (
    <div className="w-full max-w-score mx-auto flex flex-col gap-4 -mt-2">
      {/* Admin header bar */}
      <div className="-mx-[clamp(16px,4vw,36px)] px-[clamp(16px,4vw,36px)] border-b border-border bg-surface">
        <div className="flex items-center gap-3 h-14">
          <Image src="/assets/logo-purple.svg" alt="" width={22} height={22} />
          <span className="font-space font-semibold text-[15.5px]">Outreach admin</span>
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber/12 border border-amber/30 text-[11px] font-semibold text-amber">
            internal
          </span>
          <Link
            href="/dashboard"
            className="ml-auto text-[13px] font-semibold text-muted hover:text-text px-2.5 py-2 rounded-lg hover:bg-card transition-colors"
          >
            Exit to app →
          </Link>
        </div>
      </div>

      <div className="flex items-baseline gap-3 flex-wrap">
        <h1 className="font-space font-semibold text-xl m-0">Today</h1>
        <span className="text-[12.5px] text-dim">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })} · refreshes every 5 min
        </span>
      </div>

      {actionMsg && (
        <p className="text-sm text-primary-lt" role="status">{actionMsg}</p>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {statCards.map(({ n, v, d, dC, sub }) => (
          <section key={n} aria-label={n} className="bg-card border border-border rounded-[14px] px-[18px] py-4">
            <div className="text-[11.5px] font-semibold tracking-wider uppercase text-dim">{n}</div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="font-mono font-bold text-[26px] tracking-tight text-text tabular-nums">{v}</span>
              {d && <span className={cn('text-xs font-semibold', dC)}>{d}</span>}
            </div>
            <div className="text-xs text-dim mt-1">{sub}</div>
          </section>
        ))}
      </div>

      <section aria-label="Feedback inbox" className="bg-card border border-border rounded-[14px] px-5 py-[18px]">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h2 className="font-space font-semibold text-[15px] m-0">Feedback inbox</h2>
          <span className="text-[12.5px] text-dim">
            {unresolved} unresolved · {feedback.length} total
          </span>
          <div
            role="tablist"
            aria-label="Filter feedback"
            className="ml-auto flex bg-surface border border-border rounded-[9px] p-0.5 gap-0.5"
          >
            {(['All', 'Bug', 'Idea', 'Praise'] as FeedbackTab[]).map((label) => (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={tab === label}
                onClick={() => setTab(label)}
                className={cn(
                  'h-[30px] px-3 rounded-[7px] border-none text-[12.5px] font-semibold cursor-pointer transition-colors',
                  tab === label ? 'bg-primary text-white' : 'bg-transparent text-muted hover:text-text',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-dim text-sm mt-4">No feedback yet.</p>
        ) : (
          <div className="flex flex-col mt-1.5">
            {filtered.map((fb, i) => {
              const k = kindStyle(fb.type);
              const done = resolved.has(fb.id);
              const meta = [
                fb.userEmail ?? 'anonymous',
                fb.screen ?? '—',
                new Date(fb.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
              ].join(' · ');
              return (
                <div
                  key={fb.id}
                  className={cn(
                    'flex gap-3.5 py-3.5 flex-wrap',
                    i > 0 && 'border-t border-inner',
                  )}
                >
                  <span
                    className="shrink-0 inline-flex items-center self-start px-2 py-0.5 rounded-full text-[11px] font-semibold border"
                    style={{
                      color: k.color,
                      background: rgba(k.color, 0.12),
                      borderColor: rgba(k.color, 0.3),
                    }}
                  >
                    {k.label}
                  </span>
                  <span className="flex-1 min-w-[260px]">
                    <span className="block text-[13.5px] text-text text-pretty">{fb.message}</span>
                    <span className="block text-xs text-dim mt-0.5">{meta}</span>
                  </span>
                  <span className="shrink-0 flex gap-2 self-center">
                    <button
                      type="button"
                      onClick={() => toggleResolved(fb.id)}
                      className="h-[34px] px-3 rounded-lg border border-border bg-surface text-text text-[12.5px] font-semibold hover:border-hover-border transition-colors"
                    >
                      {done ? 'Resolved' : 'Resolve'}
                    </button>
                    {fb.userId && (
                      <button
                        type="button"
                        onClick={() => suspend(fb.userId!)}
                        className="h-[34px] px-2.5 rounded-lg border-none bg-transparent text-muted text-[12.5px] font-medium hover:text-text hover:bg-surface transition-colors"
                      >
                        Suspend
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 items-start">
        <section aria-label="System health" className="bg-card border border-border rounded-[14px] px-5 py-[18px]">
          <h2 className="font-space font-semibold text-[15px] m-0 mb-1">System health</h2>
          {[
            { n: 'API p95 latency', v: '—', c: '#10B981', bt: false },
            { n: 'Score pipeline', v: stats?.systemStatus ?? '—', c: '#10B981', bt: true },
            { n: 'Email import queue', v: '—', c: '#10B981', bt: true },
            { n: 'Resume parser', v: stats?.failedJobs ? `${stats.failedJobs} fails` : '—', c: '#F59E0B', bt: true },
          ].map(({ n, v, c, bt }) => (
            <div key={n} className={cn('flex gap-3 items-center py-2.5', bt && 'border-t border-inner')}>
              <span aria-hidden="true" className="shrink-0 w-2 h-2 rounded-full" style={{ background: c }} />
              <span className="flex-1 text-[13.5px] text-text">{n}</span>
              <span className="font-mono text-[12.5px] text-muted tabular-nums">{v}</span>
            </div>
          ))}
        </section>
        <section aria-label="Notes" className="bg-card border border-border rounded-[14px] px-5 py-[18px]">
          <h2 className="font-space font-semibold text-[15px] m-0 mb-2">Operator notes</h2>
          <p className="m-0 text-[13.5px] text-muted text-pretty">
            Resume-parse failures spike on scanned PDFs from college templates. Watch the retry rate after friendlier error copy ships. Season Pass conversions tracked via pricing page visits.
          </p>
          <div className="text-xs text-dim mt-2.5">— platform ops</div>
        </section>
      </div>
    </div>
  );
}
