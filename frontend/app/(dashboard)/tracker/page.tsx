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
      api.get<InboundDraftResponse[]>('/inbound-email/drafts'),
    ]);

    if (!appsRes.success) {
      setError(appsRes.error ?? 'Could not load applications.');
      setLoading(false);
      return;
    }

    setApps(pageContent(appsRes.data));
    setFollowUps(followRes.success ? pageContent(followRes.data) : []);
    setDrafts(draftsRes.success ? draftsRes.data ?? [] : []);
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

  return (
    <div className="space-y-8">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-space text-text">Application Tracker</h1>
          <p className="text-sm text-muted mt-1">
            A calm view of where you&apos;ve applied and what needs attention next.
          </p>
        </div>
        <Link href="/tracker/add" className={btnPrimary}>
          Add application
        </Link>
      </header>

      {/* Follow-ups banner */}
      {!loading && followUps.length > 0 && (
        <section
          aria-labelledby="follow-ups-heading"
          className="rounded-xl border border-orange-400/30 bg-orange-400/5 p-4 sm:p-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 id="follow-ups-heading" className="font-medium text-orange-400">
                {followUps.length} follow-up{followUps.length === 1 ? '' : 's'} due
              </h2>
              <p className="text-sm text-muted mt-1">
                These applications haven&apos;t heard back yet — a gentle nudge might help.
              </p>
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {followUps.slice(0, 3).map((app) => (
              <li key={app.id}>
                <Link
                  href={`/tracker/${app.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2 hover:bg-orange-400/10 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span className="text-sm text-text">
                    {app.company} · {app.role}
                  </span>
                  <span className="text-xs text-muted">
                    Due {fmtDate(app.nextActionDue)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Email drafts */}
      {!loading && drafts.length > 0 && (
        <section aria-labelledby="drafts-heading">
          <h2 id="drafts-heading" className="text-lg font-medium font-space text-text mb-3">
            Review imported applications
          </h2>
          <p className="text-sm text-muted mb-4">
            These came from forwarded emails — confirm the details before adding them to your tracker.
          </p>
          <div className="space-y-3">
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
      <section aria-labelledby="apps-heading">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 id="apps-heading" className="text-lg font-medium font-space text-text">
            Your applications
          </h2>
          <div
            className="flex flex-wrap gap-2"
            role="tablist"
            aria-label="Filter by status"
          >
            <FilterChip
              active={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
              label="All"
            />
            {APP_STATUSES.slice(0, 6).map((s) => (
              <FilterChip
                key={s}
                active={statusFilter === s}
                onClick={() => setStatusFilter(s)}
                label={getStatusMeta(s).label}
              />
            ))}
          </div>
        </div>

        {loading && <ApplicationListSkeleton />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && filtered.length === 0 && apps.length === 0 && (
          <EmptyApplications />
        )}
        {!loading && !error && filtered.length === 0 && apps.length > 0 && (
          <p className="text-sm text-muted text-center py-8">
            No applications with this status. Try another filter.
          </p>
        )}
        {!loading && !error && filtered.length > 0 && (
          <ul className="space-y-3" aria-label="Application list">
            {filtered.map((app) => (
              <li key={app.id}>
                <ApplicationRow
                  app={app}
                  showFollowUp={followUpIds.has(app.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-sm text-muted">
        Forward application emails to auto-import —{' '}
        <Link href="/settings" className="text-primary-lt hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
          get your forwarding address
        </Link>
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'min-h-[44px] px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        active
          ? 'bg-primary/15 text-primary-lt ring-1 ring-primary/30'
          : 'bg-surface2 text-muted hover:text-text',
      )}
    >
      {label}
    </button>
  );
}

const btnPrimary = cn(
  'inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium shrink-0',
  'bg-primary text-white hover:bg-primary-lt transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);
