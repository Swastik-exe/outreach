'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { ApplicationResponse, CareerScoreResponse, SpringPage } from '@/lib/types';
import { pageContent } from '@/lib/page';
import { fmtDate, getStatusMeta } from '@/lib/tracker';
import { ScoreRing } from '@/components/ScoreRing';
import { BandBadge } from '@/components/BandBadge';
import { VortexLoader } from '@/components/VortexLoader';
import { tokenStore } from '@/lib/api';
import { decodeJwtPayload } from '@/lib/jwt';

const COMPONENT_KEYS = [
  'applications',
  'resume',
  'skills',
  'profile',
  'github',
  'cgpa',
] as const;

const COMPONENT_META: Record<
  (typeof COMPONENT_KEYS)[number],
  { label: string; key: keyof CareerScoreResponse; max: number }
> = {
  applications: { label: 'Applications & momentum', key: 'applicationsScore', max: 200 },
  resume: { label: 'Resume readiness', key: 'resumeScore', max: 250 },
  skills: { label: 'Skills evidence', key: 'skillsScore', max: 150 },
  profile: { label: 'Profile completeness', key: 'profileScore', max: 150 },
  github: { label: 'GitHub', key: 'githubScore', max: 150 },
  cgpa: { label: 'CGPA', key: 'cgpaComponent', max: 100 },
};

function greetingForHour(h: number): string {
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstNameFromEmail(email: string | undefined): string | null {
  if (!email) return null;
  const local = email.split('@')[0] ?? '';
  const part = local.split(/[._-]+/).filter(Boolean)[0];
  if (!part) return null;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function formatUpdated(iso: string | null): string {
  if (!iso) return 'Updates when you act · stale scores refresh overnight';
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 1) return 'Updated just now · stale scores refresh overnight';
  if (hours < 24) return `Updated ${hours} hour${hours === 1 ? '' : 's'} ago · stale scores refresh overnight`;
  const days = Math.floor(hours / 24);
  return `Updated ${days} day${days === 1 ? '' : 's'} ago · stale scores refresh overnight`;
}

export default function DashboardPage() {
  const [score, setScore] = useState<CareerScoreResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apps, setApps] = useState<ApplicationResponse[]>([]);
  const [followUps, setFollowUps] = useState<ApplicationResponse[]>([]);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    setNow(new Date());
  }, []);

  const payload = decodeJwtPayload(tokenStore.get() ?? '');
  const email = typeof payload?.email === 'string' ? payload.email : undefined;
  const firstName = firstNameFromEmail(email);

  const greeting = firstName
    ? `${greetingForHour(now.getHours())}, ${firstName}`
    : greetingForHour(now.getHours());
  const todayLine = now.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const fetchScore = async () => {
    const res = await api.get<CareerScoreResponse>('/career-score');
    if (res.success && res.data) {
      setScore(res.data);
      setError('');
    } else {
      setError(res.error ?? 'Failed to load score');
    }
  };

  useEffect(() => {
    fetchScore().finally(() => setLoading(false));
    Promise.all([
      api.get<SpringPage<ApplicationResponse>>('/applications?page=0&size=50'),
      api.get<SpringPage<ApplicationResponse>>('/applications/follow-ups?page=0&size=20'),
    ]).then(([appsRes, followRes]) => {
      if (appsRes.success) setApps(pageContent(appsRes.data));
      if (followRes.success) setFollowUps(pageContent(followRes.data));
    });
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    const res = await api.post<CareerScoreResponse>('/career-score/refresh');
    if (res.success && res.data) setScore(res.data);
    setRefreshing(false);
  };

  const handleRetry = () => {
    setLoading(true);
    setError('');
    fetchScore().finally(() => setLoading(false));
  };

  const pipelineStages = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const app of apps) {
      counts[app.currentStatus] = (counts[app.currentStatus] ?? 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [apps]);

  /* ── Loading ──────────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <>
        <div className="flex items-end gap-3.5 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <h1 className="m-0 font-space font-semibold text-[21px] tracking-[0.005em]">
              {greeting}
            </h1>
            <div className="text-[13px] text-dim mt-0.5">{todayLine}</div>
          </div>
        </div>
        <section
          aria-label="Score loading"
          className="bg-card border border-border rounded-2xl min-h-[264px] flex items-center justify-center"
        >
          <VortexLoader size="lg" label="Computing today's score…" />
        </section>
        <div className="bg-card border border-border rounded-[14px] p-5 flex flex-col gap-3">
          <div className="skeleton-shimmer h-3 w-[180px] rounded-md" />
          <div className="skeleton-shimmer h-3 w-[70%] rounded-md" />
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))' }}>
          <div className="bg-card border border-border rounded-[14px] p-5 flex flex-col gap-3">
            <div className="skeleton-shimmer h-3 w-[120px] rounded-md" />
            <div className="skeleton-shimmer h-3 w-[85%] rounded-md" />
            <div className="skeleton-shimmer h-3 w-[60%] rounded-md" />
          </div>
          <div className="bg-card border border-border rounded-[14px] p-5 flex flex-col gap-3">
            <div className="skeleton-shimmer h-3 w-[120px] rounded-md" />
            <div className="skeleton-shimmer h-3 w-[85%] rounded-md" />
            <div className="skeleton-shimmer h-3 w-[60%] rounded-md" />
          </div>
        </div>
      </>
    );
  }

  /* ── Hard error (no cached score) ─────────────────────────────────────── */
  if (error && !score) {
    return (
      <>
        <div className="flex items-end gap-3.5 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <h1 className="m-0 font-space font-semibold text-[21px] tracking-[0.005em]">
              {greeting}
            </h1>
            <div className="text-[13px] text-dim mt-0.5">{todayLine}</div>
          </div>
        </div>
        <section
          aria-label="Connection problem"
          className="bg-card border border-border rounded-[14px] px-[18px] py-4 flex gap-3.5 items-start flex-wrap"
        >
          <span className="flex-none w-9 h-9 rounded-[10px] bg-[rgba(251,113,133,0.14)] flex items-center justify-center">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FB7185"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 8v5 M12 16.5v.01 M12 2.8 22 20H2Z" />
            </svg>
          </span>
          <div className="flex-1 min-w-[220px]">
            <div className="font-semibold text-[14.5px]">We couldn&apos;t refresh your score</div>
            <div className="text-[13.5px] text-muted mt-0.5">
              {error}. We retry automatically — nothing is lost.
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="h-10 px-4 rounded-[10px] border border-border bg-surface text-text text-[13.5px] font-semibold hover:border-hover-border hover:bg-card transition-colors duration-150"
          >
            Retry now
          </button>
        </section>
      </>
    );
  }

  if (!score) return null;

  const isNew = score.overallScore < 301;

  const heroLine = isNew
    ? 'Your starting point — not a verdict. Upload a resume or track an application to give the score something to work with.'
    : score.readinessNote;

  const heroMicro = score.stale
    ? 'Score may be outdated · Stale scores refresh overnight'
    : formatUpdated(score.lastComputedAt);

  const nextTitle = isNew
    ? 'Upload your resume'
    : (score.nextAction ?? 'Keep building momentum');

  const nextBody = isNew
    ? 'Resume readiness is low only because there is nothing to score yet. After analysis finishes, refresh your score (or wait for the overnight stale refresh) to see the update.'
    : 'Highest estimated impact based on your current components. Open the full breakdown to see why.';

  const nextHref =
    isNew || !(score.nextAction ?? '').toLowerCase().includes('application')
      ? '/resume'
      : '/tracker';
  const nextCta = isNew ? 'Upload resume' : 'Take action';

  return (
    <>
      {/* Header */}
      <div className="flex items-end gap-3.5 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <h1 className="m-0 font-space font-semibold text-[21px] tracking-[0.005em]">
            {greeting}
          </h1>
          <div className="text-[13px] text-dim mt-0.5">{todayLine}</div>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 h-10 px-3.5 rounded-[10px] border border-border bg-transparent text-muted text-[13.5px] font-medium whitespace-nowrap hover:text-text hover:border-hover-border hover:bg-surface transition-colors duration-150 disabled:opacity-50"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={refreshing ? 'animate-spin' : undefined}
            style={{ transformOrigin: 'center' }}
          >
            <path d="M21 12a9 9 0 1 1-2.64-6.36 M21 3v6h-6" />
          </svg>
          {refreshing ? 'Refreshing…' : 'Refresh score'}
        </button>
      </div>

      {/* Soft error banner (stale/cached with data still shown) */}
      {error && (
        <section
          aria-label="Connection problem"
          className="bg-card border border-border rounded-[14px] px-[18px] py-4 flex gap-3.5 items-start flex-wrap"
        >
          <span className="flex-none w-9 h-9 rounded-[10px] bg-[rgba(251,113,133,0.14)] flex items-center justify-center">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FB7185"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 8v5 M12 16.5v.01 M12 2.8 22 20H2Z" />
            </svg>
          </span>
          <div className="flex-1 min-w-[220px]">
            <div className="font-semibold text-[14.5px]">We couldn&apos;t refresh your score</div>
            <div className="text-[13.5px] text-muted mt-0.5">
              You&apos;re seeing cached data. We retry automatically — nothing is lost.
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            className="h-10 px-4 rounded-[10px] border border-border bg-surface text-text text-[13.5px] font-semibold hover:border-hover-border hover:bg-card transition-colors duration-150"
          >
            Retry now
          </button>
        </section>
      )}

      {/* Score hero */}
      <section
        aria-label="Career health score"
        className="bg-card border border-border rounded-2xl flex gap-[clamp(20px,4vw,40px)] items-center flex-wrap justify-center"
        style={{ padding: 'clamp(20px, 3.5vw, 30px)' }}
      >
        <ScoreRing score={score.overallScore} band={score.band} size={204} />

        <div className="flex-1 min-w-[min(100%,280px)] flex flex-col gap-3">
          <div className="text-[11px] font-semibold tracking-[0.09em] uppercase text-dim">
            Career Health Score
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <BandBadge band={score.band} />
            {isNew ? (
              <span
                className="inline-flex items-center gap-1.5 px-3 py-[5px] rounded-full whitespace-nowrap text-[12.5px] font-semibold border"
                style={{
                  background: 'rgba(165,180,195,0.10)',
                  borderColor: 'rgba(165,180,195,0.25)',
                  color: '#A5B4C3',
                }}
              >
                New today
              </span>
            ) : null}
            {score.githubWeightRedistributed && (
              <span className="text-xs text-dim">GitHub not connected — weight redistributed</span>
            )}
          </div>
          <p
            className="m-0 text-text max-w-[52ch]"
            style={{ fontSize: 15.5, lineHeight: 1.5, textWrap: 'pretty' as const }}
          >
            {heroLine}
          </p>
          <div className="text-[12.5px] text-dim">{heroMicro}</div>

          <div className="border-t border-border pt-3.5 flex flex-col gap-[9px]">
            {COMPONENT_KEYS.map((key) => {
              const c = COMPONENT_META[key];
              const value = score[c.key] as number;
              const pct = c.max > 0 ? Math.round((value / c.max) * 100) : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="flex-none text-[13px] text-muted whitespace-nowrap overflow-hidden text-ellipsis" style={{ flex: '0 0 max(150px, 34%)' }}>
                    {c.label}
                  </span>
                  <span className="flex-1 h-[5px] rounded-[3px] bg-inner overflow-hidden">
                    <span
                      className="block h-full rounded-[3px] bg-primary-hover origin-left"
                      style={{ width: `${pct}%` }}
                    />
                  </span>
                  <span className="flex-none font-mono text-[12.5px] text-text tabular-nums">
                    {value}
                    <span className="text-dim">/{c.max}</span>
                  </span>
                </div>
              );
            })}
            <Link
              href="/dashboard/breakdown"
              className="self-end mt-0.5 text-[13px] font-semibold text-primary-lt no-underline px-1 py-1.5 rounded-md hover:text-[#C4B5FD] transition-colors duration-150"
            >
              Full breakdown →
            </Link>
          </div>
        </div>
      </section>

      {/* Next action */}
      <section
        aria-label="Next action"
        className="rounded-[14px] px-[22px] py-5 flex gap-4 items-start flex-wrap"
        style={{
          background: 'linear-gradient(0deg, rgba(124,58,237,0.08), rgba(124,58,237,0.08)), #111827',
          border: '1px solid rgba(139,92,246,0.35)',
        }}
      >
        <span className="flex-none w-[38px] h-[38px] rounded-[11px] bg-[rgba(124,58,237,0.18)] flex items-center justify-center">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#A78BFA"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M13 2 4.5 13.5h6L11 22l8.5-11.5h-6L13 2Z" />
          </svg>
        </span>
        <div className="flex-1 min-w-[min(100%,240px)]">
          <div className="text-[11px] font-semibold tracking-[0.09em] uppercase text-primary-lt">
            Next action · highest estimated impact
          </div>
          <h2 className="m-0 mt-1.5 mb-1 font-space font-semibold text-[17.5px]">
            {nextTitle}
          </h2>
          <p
            className="m-0 text-[14px] text-muted max-w-[64ch]"
            style={{ textWrap: 'pretty' as const }}
          >
            {nextBody}
          </p>
        </div>
        <div className="flex gap-2.5 items-center flex-wrap">
          <Link
            href={nextHref}
            className="inline-flex items-center h-11 px-[18px] rounded-[10px] bg-primary text-white text-sm font-semibold no-underline whitespace-nowrap hover:bg-primary-hover active:bg-primary-active transition-colors duration-150"
          >
            {nextCta}
          </Link>
          <Link
            href="/dashboard/breakdown"
            className="inline-flex items-center h-11 px-3 rounded-[10px] text-muted text-[13.5px] font-medium no-underline whitespace-nowrap hover:text-text hover:bg-card transition-colors duration-150"
          >
            See why
          </Link>
        </div>
      </section>

      {/* This week + Pipeline — live from tracker APIs */}
      <div
        className="grid gap-4 items-start"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}
      >
        <section
          aria-label="This week"
          className="bg-card border border-border rounded-[14px] px-5 py-[18px]"
        >
          <div className="flex items-baseline gap-2.5">
            <h2 className="m-0 font-space font-semibold text-[15px]">This week</h2>
            <Link
              href="/tracker"
              className="ml-auto text-[12.5px] font-semibold text-primary-lt no-underline p-1 rounded-md hover:text-[#C4B5FD] transition-colors duration-150"
            >
              Tracker →
            </Link>
          </div>
          {followUps.length === 0 ? (
            <div className="px-2 pt-[22px] pb-2.5 text-center">
              <div className="text-sm font-semibold">Nothing due right now</div>
              <p className="mx-auto mt-1 mb-3.5 text-[13px] text-muted max-w-[34ch]">
                When a follow-up is due, it shows up here so you never miss a nudge.
              </p>
              <Link
                href="/tracker"
                className="inline-flex items-center h-10 px-4 rounded-[10px] border border-border bg-surface text-text text-[13.5px] font-semibold no-underline hover:border-hover-border transition-colors duration-150"
              >
                Open Tracker
              </Link>
            </div>
          ) : (
            <ul className="mt-3.5 flex flex-col gap-1">
              {followUps.slice(0, 4).map((app) => (
                <li key={app.id}>
                  <Link
                    href={`/tracker/${app.id}`}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 py-2 text-sm text-text no-underline hover:bg-row-hover transition-colors"
                  >
                    <span className="truncate">
                      {app.company} · {app.role}
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-amber">
                      Due {fmtDate(app.nextActionDue)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-label="Pipeline"
          className="bg-card border border-border rounded-[14px] px-5 py-[18px]"
        >
          <div className="flex items-baseline gap-2.5">
            <h2 className="m-0 font-space font-semibold text-[15px]">Pipeline</h2>
            {apps.length > 0 && (
              <span className="ml-auto font-mono text-[12.5px] text-dim tabular-nums">
                {apps.length} tracked
              </span>
            )}
          </div>
          {apps.length === 0 ? (
            <div className="px-2 pt-[22px] pb-2.5 text-center">
              <div className="text-sm font-semibold">No applications tracked</div>
              <p className="mx-auto mt-1 mb-3.5 text-[13px] text-muted max-w-[36ch]">
                Forward a confirmation email or add one manually — it takes 20 seconds.
              </p>
              <Link
                href="/tracker/add"
                className="inline-flex items-center h-10 px-4 rounded-[10px] bg-primary text-white text-[13.5px] font-semibold no-underline hover:bg-primary-hover transition-colors duration-150"
              >
                Add application
              </Link>
            </div>
          ) : (
            <ul className="mt-3.5 flex flex-col gap-2">
              {pipelineStages.map(([status, count]) => {
                const meta = getStatusMeta(status);
                return (
                  <li key={status} className="flex items-center gap-2.5 text-[13.5px]">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${meta.bg} ${meta.color}`}>
                      {meta.label}
                    </span>
                    <span className="ml-auto font-mono text-dim tabular-nums">{count}</span>
                  </li>
                );
              })}
              <li>
                <Link
                  href="/tracker"
                  className="inline-flex mt-1 text-[12.5px] font-semibold text-primary-lt no-underline hover:text-[#C4B5FD]"
                >
                  Open full tracker →
                </Link>
              </li>
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
