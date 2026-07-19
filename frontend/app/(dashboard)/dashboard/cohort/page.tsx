'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, tokenStore } from '@/lib/api';
import { pageContent } from '@/lib/page';
import type {
  CareerScoreResponse,
  CohortInsightResponse,
  HistoryEntry,
  SpringPage,
} from '@/lib/types';
import { bandDisplayName, getBandMeta } from '@/lib/types';
import { VortexLoader } from '@/components/VortexLoader';

const ROLE_LABELS: Record<string, string> = {
  software_engineer: 'software engineering',
  frontend_engineer: 'frontend roles',
  backend_engineer: 'backend roles',
  full_stack_engineer: 'full-stack roles',
  data_scientist: 'data science',
  data_analyst: 'data analyst roles',
  machine_learning_engineer: 'ML engineering',
  devops_engineer: 'DevOps roles',
  cloud_engineer: 'cloud engineering',
  mobile_developer: 'mobile development',
  product_manager: 'product management',
  ux_designer: 'UX design',
  security_engineer: 'security engineering',
  qa_engineer: 'QA engineering',
  business_analyst: 'business analyst roles',
};

function parseCohortKey(key: string | null | undefined): { role: string; year: string } | null {
  if (!key) return null;
  const sep = key.indexOf('|');
  if (sep < 0) return null;
  const roleSlug = key.slice(0, sep);
  const year = key.slice(sep + 1);
  const role = ROLE_LABELS[roleSlug] ?? roleSlug.replace(/_/g, ' ');
  return { role, year };
}

function weeklyDeltaFromHistory(entries: HistoryEntry[]): number | null {
  if (entries.length < 2) return null;
  const sorted = [...entries].sort((a, b) => a.recordedDate.localeCompare(b.recordedDate));
  const latest = sorted[sorted.length - 1];
  const weekAgo = new Date(latest.recordedDate);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const cutoff = weekAgo.toISOString().slice(0, 10);
  const baseline = sorted.find((e) => e.recordedDate >= cutoff) ?? sorted[0];
  return latest.overallScore - baseline.overallScore;
}

/** Decorative histogram removed — API has no histogram series; percentile marker below is real. */

export default function CohortPage() {
  const [cohort, setCohort] = useState<CohortInsightResponse | null>(null);
  const [score, setScore] = useState<CareerScoreResponse | null>(null);
  const [weeklyDelta, setWeeklyDelta] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<CohortInsightResponse>('/career-score/cohort'),
      api.get<CareerScoreResponse>('/career-score'),
      api.get<SpringPage<HistoryEntry>>('/career-score/history?page=0&size=100'),
    ])
      .then(([cohortRes, scoreRes, historyRes]) => {
        if (cohortRes.success && cohortRes.data) setCohort(cohortRes.data);
        else setError(cohortRes.error ?? 'Failed to load cohort data');

        if (scoreRes.success && scoreRes.data) setScore(scoreRes.data);

        if (historyRes.success && historyRes.data) {
          const entries = pageContent(historyRes.data);
          setWeeklyDelta(weeklyDeltaFromHistory(entries));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const parsed = parseCohortKey(cohort?.cohortKey);
  const percentile = cohort?.percentile ?? 0;
  const positionPct = Math.max(5, Math.min(95, percentile));
  const bandMeta = score ? getBandMeta(score.band) : null;

  const fetchShareCard = async (): Promise<Blob | null> => {
    const base =
      (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
      'http://localhost:8080/api/v1';
    const token = tokenStore.get();
    const res = await fetch(`${base}/career-score/share-card?variant=progress`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    return res.blob();
  };

  const handleCopyCard = async () => {
    try {
      const blob = await fetchShareCard();
      if (!blob) throw new Error('Failed to fetch card');
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleDownload = async () => {
    const blob = await fetchShareCard();
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'outreach-progress.png';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="max-w-score mx-auto w-full flex items-center justify-center min-h-[60vh]">
        <VortexLoader label="Loading cohort…" />
      </div>
    );
  }

  if (error && !cohort?.available) {
    return (
      <div className="max-w-score mx-auto w-full flex flex-col gap-4">
        <div>
          <h1 className="m-0 font-space font-semibold text-[21px]">Where you stand</h1>
          <div className="text-[13px] text-dim mt-0.5">
            Anonymized cohort comparison — never a leaderboard
          </div>
        </div>
        <section className="bg-card border border-border rounded-2xl px-5 py-8 text-center">
          <p className="text-muted text-sm max-w-[48ch] mx-auto">
            {error ||
              'Cohort insights need a target track on your profile and at least 20 peers on the same track. Check back after the nightly stats job runs.'}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex mt-4 text-[13px] font-semibold text-primary-lt no-underline hover:text-[#C4B5FD]"
          >
            Back to dashboard →
          </Link>
        </section>
      </div>
    );
  }

  if (!cohort?.available) {
    return (
      <div className="max-w-score mx-auto w-full flex flex-col gap-4">
        <div>
          <h1 className="m-0 font-space font-semibold text-[21px]">Where you stand</h1>
          <div className="text-[13px] text-dim mt-0.5">
            Anonymized cohort comparison — never a leaderboard
          </div>
        </div>
        <section className="bg-card border border-border rounded-2xl px-5 py-8 text-center">
          <p className="text-muted text-sm max-w-[48ch] mx-auto">
            Not enough peers in your cohort yet for a meaningful comparison. We need at least 20
            people on the same track — check back soon.
          </p>
        </section>
      </div>
    );
  }

  const cohortLabel = parsed?.role ?? 'your target track';
  const cohortSize = cohort.cohortSize ?? 0;

  return (
    <div className="max-w-score mx-auto w-full flex flex-col gap-4">
      <div>
        <h1 className="m-0 font-space font-semibold text-[21px]">Where you stand</h1>
        <div className="text-[13px] text-dim mt-0.5">
          Among {cohortSize.toLocaleString()} people targeting {cohortLabel} · anonymized, never a
          leaderboard
        </div>
      </div>

      {/* Percentile hero */}
      <section
        aria-label="Your percentile"
        className="bg-card border border-border rounded-2xl"
        style={{ padding: 'clamp(20px, 3.5vw, 28px)' }}
      >
        <div className="flex gap-4 items-baseline flex-wrap">
          <div className="font-space font-semibold text-[clamp(20px,3vw,24px)]">
            {cohort.band ?? 'Your band'} and climbing
          </div>
          {percentile > 0 && (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap text-[12.5px] font-semibold border"
              style={{
                background: 'rgba(16,185,129,0.10)',
                borderColor: 'rgba(16,185,129,0.28)',
                color: '#34D399',
              }}
            >
              Top {100 - percentile}% of cohort
            </span>
          )}
        </div>
        <p className="mt-2 mb-0 text-sm text-muted max-w-[64ch]" style={{ textWrap: 'pretty' }}>
          You&apos;re ahead of roughly{' '}
          <span className="text-text font-mono">{percentile}%</span> of peers in your cohort.
          {score ? (
            <>
              {' '}
              Your score is{' '}
              <span className="text-text font-mono">{score.overallScore}</span> — steady work
              compounds.
            </>
          ) : null}
        </p>

        <div className="mt-5">
          <div className="relative h-[26px] mt-2">
            <div className="absolute inset-x-0 top-[11px] h-1 rounded-sm bg-inner" />
            <div
              className="absolute left-0 top-[11px] h-1 rounded-sm"
              style={{
                width: `${positionPct}%`,
                background: 'linear-gradient(90deg, #22304A, #7C3AED)',
              }}
            />
            <div
              className="absolute top-0 flex flex-col items-center gap-0.5 -translate-x-1/2"
              style={{ left: `${positionPct}%` }}
            >
              <span
                className="w-3.5 h-3.5 rounded-full bg-primary-lt border-[3px] border-bg"
                style={{ boxShadow: '0 0 0 1.5px #A78BFA' }}
              />
            </div>
          </div>
          <div className="flex justify-between text-[11.5px] text-dim mt-0.5">
            <span>Lower</span>
            <span className="text-primary-lt font-semibold">
              You{score ? ` · ${score.overallScore}` : ''}
            </span>
            <span>Ready</span>
          </div>
        </div>

        <div className="mt-[18px] pt-3.5 border-t border-inner flex gap-2.5 items-start">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#64748B"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="flex-none mt-0.5"
          >
            <path d="M6 10V8a6 6 0 1 1 12 0v2 M5 10h14v10H5Z" />
          </svg>
          <span className="text-[12.5px] text-dim" style={{ textWrap: 'pretty' }}>
            We show your band only — never named rankings. Comparing you to a specific classmate
            helps nobody, so we don&apos;t.
          </span>
        </div>
      </section>

      <div
        className="grid gap-4 items-start"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}
      >
        {/* Share card */}
        <section
          aria-label="Shareable progress card"
          className="bg-card border border-border rounded-2xl p-5"
        >
          <h2 className="m-0 font-space font-semibold text-[15px]">Share your week</h2>
          <p className="mt-1 mb-3.5 text-[12.5px] text-dim">
            Progress, not score — a card you&apos;d actually post.
          </p>
          <div
            className="rounded-2xl p-[22px] border border-hover-border"
            style={{
              background: 'linear-gradient(145deg, #0B1220, #131A2E 55%, #1A1330)',
              boxShadow: '0 16px 40px rgba(0,0,0,0.4)',
            }}
          >
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logo-purple.svg" alt="" width={20} height={20} />
              <span className="font-space font-semibold text-[13.5px] text-text">Outreach</span>
              <span className="ml-auto text-[11px] text-dim">This week</span>
            </div>
            <div className="mt-[18px] font-mono font-bold text-[44px] leading-none text-success-lt tabular-nums">
              {weeklyDelta != null ? (weeklyDelta >= 0 ? `+${weeklyDelta}` : weeklyDelta) : '—'}
            </div>
            <div className="mt-1.5 text-[13.5px] text-muted">Career Health points this week</div>
            <div className="flex gap-2 mt-4 flex-wrap">
              {score && (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11.5px] font-semibold border"
                  style={{
                    background: bandMeta?.chipBg,
                    borderColor: bandMeta?.chipBd,
                    color: '#C4B5FD',
                  }}
                >
                  {bandDisplayName(score.band)} band
                </span>
              )}
              {cohort.band && (
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded-full text-[11.5px] font-semibold border"
                  style={{
                    background: 'rgba(45,212,191,0.1)',
                    borderColor: 'rgba(45,212,191,0.3)',
                    color: '#2DD4BF',
                  }}
                >
                  {cohort.band}
                </span>
              )}
            </div>
            <div className="mt-[18px] pt-3 border-t border-[rgba(51,69,107,0.6)] text-[11px] text-dim">
              readiness, not a guarantee · Outreach
            </div>
          </div>
          <div className="flex gap-2.5 mt-3.5">
            <button
              type="button"
              onClick={handleCopyCard}
              className="flex-1 h-[42px] rounded-[10px] border-none bg-primary text-white text-[13.5px] font-semibold cursor-pointer hover:bg-primary-hover transition-colors duration-150"
            >
              {copied ? 'Copied ✓' : 'Copy as image'}
            </button>
            <button
              type="button"
              onClick={handleDownload}
              className="h-[42px] px-4 rounded-[10px] border border-border bg-surface text-text text-[13.5px] font-semibold cursor-pointer hover:border-hover-border transition-colors duration-150"
            >
              Download
            </button>
          </div>
          <div className="mt-2.5 text-[11.5px] text-dim text-center">
            Progress cards include your current score and weekly change.
          </div>
        </section>

        {/* Cohort facts */}
        <section
          aria-label="Cohort facts"
          className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-1"
        >
          <h2 className="m-0 mb-2 font-space font-semibold text-[15px]">Your cohort this week</h2>
          <div className="flex flex-col">
            {cohortSize > 0 && (
              <div className="flex gap-3 items-baseline py-[11px]">
                <span className="flex-none font-mono text-[15px] font-semibold text-primary-lt tabular-nums min-w-[58px]">
                  {cohortSize.toLocaleString()}
                </span>
                <span className="flex-1 text-[13.5px] text-muted" style={{ textWrap: 'pretty' }}>
                  people in your cohort — same stage and target track
                </span>
              </div>
            )}
            {cohort.band && (
              <div
                className="flex gap-3 items-baseline py-[11px] border-t border-inner"
              >
                <span className="flex-none font-mono text-[15px] font-semibold text-success-lt tabular-nums min-w-[58px]">
                  {cohort.band}
                </span>
                <span className="flex-1 text-[13.5px] text-muted" style={{ textWrap: 'pretty' }}>
                  your standing band — percentile rank {percentile}%
                </span>
              </div>
            )}
            {score && (
              <div className="flex gap-3 items-baseline py-[11px] border-t border-inner">
                <span className="flex-none font-mono text-[15px] font-semibold text-text tabular-nums min-w-[58px]">
                  {score.overallScore}
                </span>
                <span className="flex-1 text-[13.5px] text-muted" style={{ textWrap: 'pretty' }}>
                  your score vs cohort peers — {bandDisplayName(score.band)} band
                </span>
              </div>
            )}
            {parsed?.year && (
              <div className="flex gap-3 items-baseline py-[11px] border-t border-inner">
                <span className="flex-none font-mono text-[15px] font-semibold text-teal tabular-nums min-w-[58px]">
                  {parsed.year}
                </span>
                <span className="flex-1 text-[13.5px] text-muted" style={{ textWrap: 'pretty' }}>
                  graduation cohort year
                </span>
              </div>
            )}
          </div>
          <div
            className="mt-auto pt-3 border-t border-inner text-[12.5px] text-dim"
            style={{ textWrap: 'pretty' }}
          >
            Cohort = same stage + same target track. Medians, never identities.
          </div>
        </section>
      </div>
    </div>
  );
}
