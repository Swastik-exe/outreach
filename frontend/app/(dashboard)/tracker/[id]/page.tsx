'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  APP_STATUSES,
  OUTCOME_OPTIONS,
  PRIORITY_OPTIONS,
  TERMINAL_STATUSES,
  fmtDate,
  fmtDateTime,
  getStatusMeta,
} from '@/lib/tracker';
import type {
  ApplicationResponse,
  OutcomeRequest,
  StatusUpdateRequest,
  TimelineEntryResponse,
  UpdateApplicationRequest,
} from '@/lib/types';
import { StatusBadge } from '@/components/tracker/StatusBadge';
import { ApplicationListSkeleton } from '@/components/tracker/ApplicationSkeleton';
import { ErrorState } from '@/components/tracker/TrackerStates';
import { cn } from '@/lib/utils';

function timelineDotColor(status: string): string {
  if (['rejected', 'ghosted', 'withdrawn', 'offer_declined'].includes(status)) {
    return '#64748B';
  }
  if (['offer_received', 'offer_accepted'].includes(status)) {
    return '#10B981';
  }
  if (
    [
      'interview_scheduled',
      'interview_done',
      'technical_round',
      'hr_round',
      'shortlisted',
    ].includes(status)
  ) {
    return '#2DD4BF';
  }
  if (['pending_oa', 'oa_submitted'].includes(status)) {
    return '#F59E0B';
  }
  return '#8B5CF6';
}

export default function ApplicationDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const router = useRouter();
  const [app, setApp] = useState<ApplicationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [outcome, setOutcome] = useState<OutcomeRequest['outcome']>('interview_got');
  const [outcomeBusy, setOutcomeBusy] = useState(false);
  const [outcomeDone, setOutcomeDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await api.get<ApplicationResponse>(`/applications/${id}`);
    if (!res.success || !res.data) {
      setError(res.error ?? 'Application not found.');
      setLoading(false);
      return;
    }
    setApp(res.data);
    setNewStatus(res.data.currentStatus);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const timeline = useMemo(() => {
    const entries = app?.timeline ?? [];
    return [...entries].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );
  }, [app?.timeline]);

  const isTerminal = app ? TERMINAL_STATUSES.has(app.currentStatus as never) : false;

  async function handleStatusSubmit(e: FormEvent) {
    e.preventDefault();
    if (!app || newStatus === app.currentStatus) return;
    setStatusBusy(true);
    setStatusError(null);

    const prev = app;
    const optimisticEntry: TimelineEntryResponse = {
      id: `optimistic-${Date.now()}`,
      status: newStatus,
      notes: statusNotes.trim() || null,
      occurredAt: new Date().toISOString(),
      createdBy: 'you',
    };
    setApp({
      ...app,
      currentStatus: newStatus,
      timeline: [...(app.timeline ?? []), optimisticEntry],
    });

    const body: StatusUpdateRequest = {
      status: newStatus,
      notes: statusNotes.trim() || undefined,
    };
    const res = await api.put<ApplicationResponse>(`/applications/${id}/status`, body);
    setStatusBusy(false);

    if (!res.success || !res.data) {
      setApp(prev);
      setStatusError(res.error ?? 'Could not update status.');
      return;
    }
    setApp(res.data);
    setStatusNotes('');
  }

  async function handleEditSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!app) return;
    setEditBusy(true);
    setEditError(null);
    const fd = new FormData(e.currentTarget);
    const body: UpdateApplicationRequest = {
      company: String(fd.get('company') ?? '').trim() || undefined,
      role: String(fd.get('role') ?? '').trim() || undefined,
      appliedDate: String(fd.get('appliedDate') ?? '') || undefined,
      jobUrl: String(fd.get('jobUrl') ?? '').trim() || undefined,
      priority: String(fd.get('priority') ?? '') || undefined,
      notes: String(fd.get('notes') ?? '').trim() || undefined,
    };
    const res = await api.put<ApplicationResponse>(`/applications/${id}`, body);
    setEditBusy(false);
    if (!res.success || !res.data) {
      setEditError(res.error ?? 'Could not save changes.');
      return;
    }
    setApp((prev) => ({ ...res.data!, timeline: prev?.timeline ?? res.data!.timeline }));
    setEditing(false);
  }

  async function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleteBusy(true);
    const res = await api.del<void>(`/applications/${id}`);
    setDeleteBusy(false);
    if (!res.success) return;
    router.push('/tracker');
  }

  async function handleOutcome(e: FormEvent) {
    e.preventDefault();
    setOutcomeBusy(true);
    const res = await api.post<void>(`/applications/${id}/outcome`, { outcome });
    setOutcomeBusy(false);
    if (res.success) setOutcomeDone(true);
  }

  if (loading) {
    return <ApplicationListSkeleton count={3} />;
  }

  if (error || !app) {
    return (
      <div className="flex flex-col gap-4">
        <ErrorState message={error ?? 'Application not found.'} onRetry={load} />
        <Link
          href="/tracker"
          className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted transition-colors hover:text-text"
        >
          <BackIcon />
          All applications
        </Link>
      </div>
    );
  }

  const subtitleParts = [
    `Applied ${fmtDate(app.appliedDate)}`,
    app.source.replace(/_/g, ' '),
    app.priority,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          href="/tracker"
          className={cn(
            'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 -ml-2.5',
            'text-[13.5px] font-medium text-muted transition-colors',
            'hover:bg-card hover:text-text',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        >
          <BackIcon />
          All applications
        </Link>
      </div>

      <header className="flex flex-wrap items-start gap-3.5">
        <div className="min-w-[240px] flex-1">
          <h1 className="font-space text-[21px] font-semibold text-text">
            {app.company} · {app.role}
          </h1>
          <p className="mt-1 text-[13px] text-dim">{subtitleParts.join(' · ')}</p>
        </div>
        <StatusBadge status={app.currentStatus} />
      </header>

      {app.nextActionDue && (
        <section
          aria-label="Follow-up"
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
            <div className="text-[14.5px] font-semibold text-text">
              {app.nextAction ?? 'Follow-up reminder'}
            </div>
            <div className="text-[13px] text-muted">
              Due {fmtDate(app.nextActionDue)}
            </div>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(300px,1fr)]">
        {/* Timeline */}
        <section
          aria-labelledby="timeline-heading"
          className="rounded-[14px] border border-border bg-card px-5 py-[18px]"
        >
          <div className="flex items-baseline gap-2.5">
            <h2
              id="timeline-heading"
              className="font-space text-[15px] font-semibold text-text"
            >
              Timeline
            </h2>
            <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] text-dim">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M6 10V8a6 6 0 1 1 12 0v2 M5 10h14v10H5Z" />
              </svg>
              Permanent record
            </span>
          </div>

          {timeline.length === 0 ? (
            <p className="mt-4 text-sm text-dim">No timeline entries yet.</p>
          ) : (
            <ol className="mt-3.5 flex flex-col" aria-label="Application timeline">
              {timeline.map((entry, i) => (
                <li key={entry.id} className="flex gap-3.5">
                  <span className="flex flex-col items-center">
                    <span
                      aria-hidden="true"
                      className="mt-1 h-[9px] w-[9px] shrink-0 rounded-full"
                      style={{ backgroundColor: timelineDotColor(entry.status) }}
                    />
                    {i < timeline.length - 1 && (
                      <span
                        aria-hidden="true"
                        className="my-1 w-[1.5px] flex-1 bg-border"
                      />
                    )}
                  </span>
                  <span
                    className={cn('flex-1', i < timeline.length - 1 ? 'pb-4' : 'pb-1')}
                  >
                    <span className="block text-[13.5px] font-semibold text-text">
                      {getStatusMeta(entry.status).label}
                      {entry.notes ? ` — ${entry.notes}` : ''}
                    </span>
                    <time
                      className="mt-0.5 block text-[11.5px] text-dim"
                      dateTime={entry.occurredAt}
                    >
                      {fmtDateTime(entry.occurredAt)}
                    </time>
                  </span>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-1.5 border-t border-inner pt-3 text-xs text-dim">
            Entries can&apos;t be edited or deleted — an honest record is the point.
          </p>
        </section>

        <div className="flex flex-col gap-4">
          {/* Log an update */}
          {!isTerminal && (
            <section
              aria-label="Log an update"
              className="rounded-[14px] border border-border bg-card px-5 py-[18px]"
            >
              <h2 className="mb-3 font-space text-[15px] font-semibold text-text">
                Log an update
              </h2>
              <form onSubmit={handleStatusSubmit} className="space-y-3.5">
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">
                    New status
                  </span>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className={inputCls}
                  >
                    {APP_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {getStatusMeta(s).label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">
                    Or write your own
                  </span>
                  <textarea
                    value={statusNotes}
                    onChange={(e) => setStatusNotes(e.target.value)}
                    rows={2}
                    className={cn(inputCls, 'min-h-[72px] resize-y py-2.5')}
                    placeholder="e.g. Recruiter asked for references"
                  />
                </label>
                {statusError && (
                  <p className="text-sm text-amber" role="alert">
                    {statusError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={statusBusy || newStatus === app.currentStatus}
                  className={btnPrimary}
                >
                  {statusBusy ? 'Updating…' : 'Add to timeline'}
                </button>
              </form>
            </section>
          )}

          {/* Details */}
          <section
            aria-label="Details"
            className="rounded-[14px] border border-border bg-card px-5 py-[18px]"
          >
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h2 className="font-space text-[15px] font-semibold text-text">Details</h2>
              {!editing && (
                <button type="button" onClick={() => setEditing(true)} className={btnSecondary}>
                  Edit
                </button>
              )}
            </div>
            {editing ? (
              <form onSubmit={handleEditSubmit} className="space-y-3">
                <EditField label="Company" name="company" defaultValue={app.company} />
                <EditField label="Role" name="role" defaultValue={app.role} />
                <EditField
                  label="Applied date"
                  name="appliedDate"
                  type="date"
                  defaultValue={app.appliedDate}
                />
                <EditField label="Job URL" name="jobUrl" defaultValue={app.jobUrl ?? ''} />
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">
                    Priority
                  </span>
                  <select name="priority" defaultValue={app.priority} className={inputCls}>
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">
                    Notes
                  </span>
                  <textarea
                    name="notes"
                    defaultValue={app.notes ?? ''}
                    rows={3}
                    className={cn(inputCls, 'min-h-[88px] resize-y py-2.5')}
                  />
                </label>
                {editError && (
                  <p className="text-sm text-amber" role="alert">
                    {editError}
                  </p>
                )}
                <div className="flex flex-wrap gap-2.5">
                  <button type="submit" disabled={editBusy} className={btnPrimary}>
                    {editBusy ? 'Saving…' : 'Save changes'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(false)}
                    className={btnSecondary}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-col gap-2 text-[13.5px]">
                <DetailRow label="Source" value={app.source.replace(/_/g, ' ')} />
                {app.recruiterEmail && (
                  <DetailRow label="Contact" value={app.recruiterEmail} />
                )}
                {app.jobUrl && (
                  <DetailRow
                    label="Job URL"
                    value={
                      <a
                        href={app.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-lt hover:underline"
                      >
                        {app.jobUrl}
                      </a>
                    }
                  />
                )}
                {app.nextActionDue && (
                  <DetailRow
                    label="Next step"
                    value={`${app.nextAction ?? 'Follow up'} · ${fmtDate(app.nextActionDue)}`}
                  />
                )}
                {app.notes && <DetailRow label="Notes" value={app.notes} />}
                {!app.jobUrl && !app.notes && !app.recruiterEmail && !app.nextActionDue && (
                  <p className="text-dim">No extra details yet.</p>
                )}
              </div>
            )}
          </section>

          {/* Outcome (terminal states) */}
          {isTerminal && (
            <section className="rounded-[14px] border border-border bg-card px-5 py-[18px]">
              <h2 className="font-space text-[15px] font-semibold text-text">Log outcome</h2>
              <p className="mt-1 text-[13px] text-muted">
                Help us learn what worked — this feeds your career score over time.
              </p>
              {outcomeDone ? (
                <p className="mt-3 text-sm text-success-lt">Outcome recorded. Thank you.</p>
              ) : (
                <form onSubmit={handleOutcome} className="mt-4 space-y-3">
                  <select
                    value={outcome}
                    onChange={(e) =>
                      setOutcome(e.target.value as OutcomeRequest['outcome'])
                    }
                    className={inputCls}
                  >
                    {OUTCOME_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  <button type="submit" disabled={outcomeBusy} className={btnPrimary}>
                    {outcomeBusy ? 'Saving…' : 'Record outcome'}
                  </button>
                </form>
              )}
            </section>
          )}

          {/* Delete */}
          <section className="border-t border-inner pt-4">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteBusy}
              className={cn(
                'h-10 rounded-[10px] px-4 text-[13.5px] font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                confirmDelete
                  ? 'bg-amber/10 text-amber hover:bg-amber/20'
                  : 'border border-border text-muted hover:border-hover-border hover:text-text',
              )}
            >
              {deleteBusy
                ? 'Removing…'
                : confirmDelete
                  ? 'Confirm remove from tracker'
                  : 'Remove from tracker'}
            </button>
            {confirmDelete && !deleteBusy && (
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="ml-2 h-10 px-2 text-sm text-muted hover:text-text"
              >
                Cancel
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5">
      <span className="w-[110px] shrink-0 text-dim">{label}</span>
      <span className="text-text capitalize">{value}</span>
    </div>
  );
}

function EditField({
  label,
  name,
  defaultValue,
  type = 'text',
}: {
  label: string;
  name: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} className={inputCls} />
    </label>
  );
}

function BackIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 5l-7 7 7 7" />
    </svg>
  );
}

const inputCls = cn(
  'w-full rounded-[10px] border border-border bg-bg px-3 text-sm text-text',
  'h-11 focus-visible:outline-none focus-visible:border-primary',
);

const btnPrimary = cn(
  'inline-flex h-10 items-center justify-center rounded-[10px] px-4',
  'text-[13.5px] font-semibold text-white bg-primary transition-colors',
  'hover:bg-primary-hover disabled:opacity-50',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);

const btnSecondary = cn(
  'inline-flex h-10 items-center justify-center rounded-[10px] border border-border bg-bg px-4',
  'text-[13.5px] font-semibold text-text transition-colors',
  'hover:border-hover-border disabled:opacity-50',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);
