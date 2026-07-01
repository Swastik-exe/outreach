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
import { ApplicationSkeleton } from '@/components/tracker/ApplicationSkeleton';
import { ErrorState } from '@/components/tracker/TrackerStates';
import { cn } from '@/lib/utils';

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
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <ApplicationSkeleton />
        <ApplicationSkeleton />
      </div>
    );
  }

  if (error || !app) {
    return (
      <div className="max-w-2xl mx-auto">
        <ErrorState message={error ?? 'Application not found.'} onRetry={load} />
        <Link href="/tracker" className="mt-4 inline-block text-sm text-primary-lt hover:underline">
          ← Back to tracker
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <header>
        <Link
          href="/tracker"
          className="text-sm text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          ← Back to tracker
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold font-space text-text">{app.company}</h1>
            <p className="text-muted mt-1">{app.role}</p>
          </div>
          <StatusBadge status={app.currentStatus} />
        </div>
        <dl className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
          <Meta label="Applied">{fmtDate(app.appliedDate)}</Meta>
          <Meta label="Source">{app.source.replace(/_/g, ' ')}</Meta>
          <Meta label="Priority">{app.priority}</Meta>
          {app.nextActionDue && (
            <Meta label="Follow-up due">{fmtDate(app.nextActionDue)}</Meta>
          )}
        </dl>
      </header>

      {/* Status change */}
      {!isTerminal && (
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="font-medium text-text">Update status</h2>
          <p className="text-sm text-muted mt-1">
            Each change is recorded in your timeline — progress at your own pace.
          </p>
          <form onSubmit={handleStatusSubmit} className="mt-4 space-y-3">
            <label className="block">
              <span className="text-xs text-muted">New status</span>
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
              <span className="text-xs text-muted">Notes (optional)</span>
              <input
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                className={inputCls}
                placeholder="e.g. Recruiter replied, OA link received"
              />
            </label>
            {statusError && (
              <p className="text-sm text-orange-400" role="alert">
                {statusError}
              </p>
            )}
            <button
              type="submit"
              disabled={statusBusy || newStatus === app.currentStatus}
              className={btnPrimary}
            >
              {statusBusy ? 'Updating…' : 'Update status'}
            </button>
          </form>
        </section>
      )}

      {/* Timeline */}
      <section aria-labelledby="timeline-heading">
        <h2 id="timeline-heading" className="font-medium font-space text-text">
          Timeline
        </h2>
        <p className="text-sm text-muted mt-1">Newest first — your journey, recorded.</p>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted mt-4">No timeline entries yet.</p>
        ) : (
          <ol className="mt-4 space-y-3" aria-label="Application timeline">
            {timeline.map((entry) => (
              <li
                key={entry.id}
                className="relative pl-4 border-l-2 border-border"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={entry.status} />
                  <time className="text-xs text-muted" dateTime={entry.occurredAt}>
                    {fmtDateTime(entry.occurredAt)}
                  </time>
                </div>
                {entry.notes && (
                  <p className="text-sm text-muted mt-1">{entry.notes}</p>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Edit details */}
      <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-medium text-text">Details</h2>
          {!editing && (
            <button type="button" onClick={() => setEditing(true)} className={btnSecondary}>
              Edit
            </button>
          )}
        </div>
        {editing ? (
          <form onSubmit={handleEditSubmit} className="mt-4 space-y-3">
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
              <span className="text-xs text-muted">Priority</span>
              <select
                name="priority"
                defaultValue={app.priority}
                className={inputCls}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-muted">Notes</span>
              <textarea
                name="notes"
                defaultValue={app.notes ?? ''}
                rows={3}
                className={cn(inputCls, 'min-h-[88px] resize-y')}
              />
            </label>
            {editError && (
              <p className="text-sm text-orange-400" role="alert">
                {editError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
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
          <div className="mt-3 text-sm text-muted space-y-1">
            {app.jobUrl && (
              <p>
                Job:{' '}
                <a
                  href={app.jobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-lt hover:underline"
                >
                  {app.jobUrl}
                </a>
              </p>
            )}
            {app.notes && <p>Notes: {app.notes}</p>}
            {!app.jobUrl && !app.notes && <p>No extra details yet.</p>}
          </div>
        )}
      </section>

      {/* Outcome (terminal states) */}
      {isTerminal && (
        <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <h2 className="font-medium text-text">Log outcome</h2>
          <p className="text-sm text-muted mt-1">
            Help us learn what worked — this feeds your career score over time.
          </p>
          {outcomeDone ? (
            <p className="mt-3 text-sm text-emerald-400">Outcome recorded. Thank you.</p>
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
      <section className="border-t border-border pt-6">
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteBusy}
          className={cn(
            'min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            confirmDelete
              ? 'bg-orange-400/10 text-orange-400 hover:bg-orange-400/20'
              : 'text-muted hover:text-text border border-border',
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
            className="ml-2 text-sm text-muted hover:text-text min-h-[44px] px-2"
          >
            Cancel
          </button>
        )}
      </section>
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-text capitalize">{children}</dd>
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
      <span className="text-xs text-muted">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className={inputCls}
      />
    </label>
  );
}

const inputCls = cn(
  'mt-1 w-full min-h-[44px] rounded-lg border border-border bg-bg px-3 py-2 text-sm text-text',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);

const btnPrimary = cn(
  'inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium',
  'bg-primary text-white hover:bg-primary-lt disabled:opacity-50 transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);

const btnSecondary = cn(
  'inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium',
  'border border-border text-muted hover:text-text hover:bg-surface2 transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);
