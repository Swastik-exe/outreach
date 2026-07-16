'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { pageContent } from '@/lib/page';
import { APP_STATUSES, getStatusMeta, fmtDate } from '@/lib/tracker';
import type { ApplicationResponse, InboundDraftResponse, SpringPage } from '@/lib/types';
import { ApplicationListSkeleton } from '@/components/tracker/ApplicationSkeleton';
import { ApplicationRow } from '@/components/tracker/ApplicationRow';
import { DraftCard } from '@/components/tracker/DraftCard';
import { EmptyApplications, ErrorState } from '@/components/tracker/TrackerStates';
import { cn } from '@/lib/utils';

export default function TrackerPage() {
  const [apps, setApps] = useState<ApplicationResponse[]>([]);
  const [followUps, setFollowUps] = useState<ApplicationResponse[]>([]);
  const [drafts, setDrafts] = useState<InboundDraftResponse[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [appsRes, followRes, draftsRes] = await Promise.all([
      api.get<SpringPage<ApplicationResponse>>('/applications?page=0&size=100'),
      api.get<SpringPage<ApplicationResponse>>('/applications/follow-ups?page=0&size=50'),
      api.get<SpringPage<InboundDraftResponse>>('/inbound-email/drafts?page=0&size=50'),
    ]);

    if (!appsRes.success) {
      setError(appsRes.error ?? 'Could not load applications.');
      setLoading(false);
      return;
    }

    setApps(pageContent(appsRes.data));
    setFollowUps(followRes.success ? pageContent(followRes.data) : []);
    setDrafts(draftsRes.success ? pageContent(draftsRes.data) : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const followUpIds = useMemo(
    () => new Set(followUps.map((a) => a.id)),
    [followUps],
  );

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return apps;
    return apps.filter((a) => a.currentStatus === statusFilter);
  }, [apps, statusFilter]);

  const subCount = useMemo(() => {
    if (loading) return '';
    if (apps.length === 0) return 'Nothing tracked yet';
    const attention = followUps.length;
    const attentionNote =
      attention > 0
        ? ` · ${attention} need attention`
        : '';
    if (statusFilter === 'all') {
      return `${apps.length} tracked${attentionNote}`;
    }
    return `${filtered.length} shown of ${apps.length}${attentionNote}`;
  }, [apps.length, filtered.length, followUps.length, loading, statusFilter]);

  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = { all: apps.length };
    for (const s of APP_STATUSES.slice(0, 6)) {
      counts[s] = apps.filter((a) => a.currentStatus === s).length;
    }
    return counts;
  }, [apps]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end gap-3.5">
        <div className="min-w-[220px] flex-1">
          <h1 className="font-space text-[21px] font-semibold text-text">Applications</h1>
          {subCount && (
            <p className="mt-0.5 text-[13px] text-dim">{subCount}</p>
          )}
        </div>
        <Link href="/tracker/add" className={btnPrimary}>
          <PlusIcon />
          Add application
        </Link>
      </header>

      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {/* Follow-ups banner */}
      {!loading && followUps.length > 0 && (
        <section
          aria-labelledby="follow-ups-heading"
          className="flex flex-wrap items-center gap-3.5 rounded-[14px] border border-primary-lt/35 bg-[linear-gradient(0deg,rgba(124,58,237,0.08),rgba(124,58,237,0.08)),#111827] px-[18px] py-4"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-primary/20">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#A78BFA"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 21a9 9 0 1 0-9-9 M12 7v5l3.5 2 M3 12h.01" />
            </svg>
          </span>
          <div className="min-w-[220px] flex-1">
            <h2 id="follow-ups-heading" className="text-[14.5px] font-semibold text-text">
              {followUps.length} follow-up{followUps.length === 1 ? '' : 's'} due
            </h2>
            <p className="text-[13px] text-muted">
              These applications haven&apos;t heard back yet — a gentle nudge might help.
            </p>
          </div>
          <ul className="w-full space-y-1 border-t border-inner pt-3 sm:w-auto sm:border-0 sm:pt-0">
            {followUps.slice(0, 3).map((app) => (
              <li key={app.id}>
                <Link
                  href={`/tracker/${app.id}`}
                  className="flex min-h-[44px] flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-text transition-colors hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span>
                    {app.company} · {app.role}
                  </span>
                  <span className="text-xs font-semibold text-amber">
                    Due {fmtDate(app.nextActionDue)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Email drafts banner */}
      {!loading && drafts.length > 0 && (
        <a
          href="#drafts-section"
          className="flex w-full cursor-pointer items-center gap-3.5 rounded-[14px] border border-teal/30 bg-[linear-gradient(0deg,rgba(45,212,191,0.07),rgba(45,212,191,0.07)),#111827] px-[18px] py-[15px] text-left transition-colors hover:border-teal/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-teal/15">
            <svg
              width="17"
              height="17"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2DD4BF"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3.5 6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z M3.5 7l8.5 6 8.5-6" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-semibold text-text">
              {drafts.length} imported email draft{drafts.length === 1 ? '' : 's'} to review
            </span>
            <span className="block text-[13px] text-muted">
              Confirmation emails arrived at your forwarding address. Approve to add them.
            </span>
          </span>
          <span className="shrink-0 text-[13px] font-semibold whitespace-nowrap text-teal">
            Review →
          </span>
        </a>
      )}

      {/* Email drafts */}
      {!loading && drafts.length > 0 && (
        <section id="drafts-section" aria-labelledby="drafts-heading" className="flex flex-col gap-4">
          <div>
            <h2 id="drafts-heading" className="font-space text-[21px] font-semibold text-text">
              Review imported drafts
            </h2>
            <p className="mt-1 max-w-[62ch] text-[13.5px] text-muted">
              These arrived at your forwarding address. We only read application emails you
              forward — nothing else. Approve what&apos;s right; nothing is added without you.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            {drafts.map((d) => (
              <DraftCard
                key={d.id}
                draft={d}
                onResolved={(id) => {
                  setDrafts((prev) => prev.filter((x) => x.id !== id));
                  load();
                }}
              />
            ))}
          </div>
        </section>
      )}

      {/* Status filter */}
      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label="Filter by stage"
      >
        <FilterChip
          active={statusFilter === 'all'}
          onClick={() => setStatusFilter('all')}
          label="All"
          count={filterCounts.all}
        />
        {APP_STATUSES.slice(0, 6).map((s) => (
          <FilterChip
            key={s}
            active={statusFilter === s}
            onClick={() => setStatusFilter(s)}
            label={getStatusMeta(s).label}
            count={filterCounts[s]}
          />
        ))}
      </div>

      <section aria-labelledby="apps-heading">
        {loading && <ApplicationListSkeleton />}
        {!loading && !error && filtered.length === 0 && apps.length === 0 && (
          <EmptyApplications />
        )}
        {!loading && !error && filtered.length === 0 && apps.length > 0 && (
          <p className="py-8 text-center text-sm text-dim">
            No applications with this status. Try another filter.
          </p>
        )}
        {!loading && !error && filtered.length > 0 && (
          <>
            <section
              aria-label="Application list"
              className="overflow-hidden rounded-[14px] border border-border bg-card"
            >
              <ul>
                {filtered.map((app, i) => (
                  <li
                    key={app.id}
                    className={i > 0 ? 'border-t border-inner' : undefined}
                  >
                    <ApplicationRow
                      app={app}
                      showFollowUp={followUpIds.has(app.id)}
                    />
                  </li>
                ))}
              </ul>
            </section>
            <p className="mt-4 text-center text-[12.5px] text-dim">
              Statuses are journey markers — a closed role is a data point, not a failure.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold whitespace-nowrap transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        active
          ? 'border border-primary-lt/45 bg-primary/15 text-[#C4B5FD]'
          : 'border border-border bg-transparent text-muted hover:border-hover-border',
      )}
    >
      {label}
      {count != null && (
        <span className="ml-[7px] font-mono text-[11.5px] text-dim">{count}</span>
      )}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M12 5v14 M5 12h14" />
    </svg>
  );
}

const btnPrimary = cn(
  'inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] px-[18px]',
  'text-sm font-semibold text-white bg-primary transition-colors whitespace-nowrap',
  'hover:bg-primary-hover',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);
