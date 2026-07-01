'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PRIORITY_OPTIONS, SOURCE_OPTIONS } from '@/lib/tracker';
import type {
  ApplicationResponse,
  CreateApplicationRequest,
  CreateApplicationResult,
} from '@/lib/types';
import { cn } from '@/lib/utils';

export default function AddApplicationPage() {
  const router = useRouter();
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [source, setSource] = useState('manual');
  const [appliedDate, setAppliedDate] = useState(
    () => new Date().toISOString().slice(0, 10),
  );
  const [jobUrl, setJobUrl] = useState('');
  const [priority, setPriority] = useState('medium');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<{
    payload: CreateApplicationRequest;
    existing: ApplicationResponse;
  } | null>(null);

  function buildPayload(): CreateApplicationRequest {
    return {
      company: company.trim(),
      role: role.trim(),
      source,
      appliedDate,
      jobUrl: jobUrl.trim() || undefined,
      priority,
      notes: notes.trim() || undefined,
    };
  }

  async function submit(force = false) {
    setSubmitting(true);
    setError(null);
    const payload = buildPayload();
    const res = await api.post<CreateApplicationResult>(
      '/applications',
      payload,
      force ? { force: true } : undefined,
    );
    setSubmitting(false);

    if (!res.success) {
      setError(res.error ?? 'Could not save this application.');
      return;
    }

    if (res.data?.possibleDuplicate && res.data.existingMatch) {
      setDuplicate({ payload, existing: res.data.existingMatch });
      return;
    }

    const app = res.data?.application;
    if (app?.id) {
      router.push(`/tracker/${app.id}`);
    } else {
      router.push('/tracker');
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setDuplicate(null);
    submit(false);
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <header>
        <Link
          href="/tracker"
          className="text-sm text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
        >
          ← Back to tracker
        </Link>
        <h1 className="mt-3 text-2xl font-bold font-space text-text">Add application</h1>
        <p className="text-sm text-muted mt-1">
          Record a new application — you can update the status as things progress.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Company" required>
          <input
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={inputCls}
            placeholder="e.g. Google"
          />
        </Field>

        <Field label="Role" required>
          <input
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputCls}
            placeholder="e.g. Software Engineer"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Source">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className={inputCls}
            >
              {SOURCE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Applied date" required>
            <input
              type="date"
              required
              value={appliedDate}
              onChange={(e) => setAppliedDate(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Job URL">
          <input
            type="url"
            value={jobUrl}
            onChange={(e) => setJobUrl(e.target.value)}
            className={inputCls}
            placeholder="https://…"
          />
        </Field>

        <Field label="Priority">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className={inputCls}
          >
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Notes">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className={cn(inputCls, 'resize-y min-h-[88px]')}
            placeholder="Optional context — referral, recruiter name, etc."
          />
        </Field>

        {error && (
          <p className="text-sm text-orange-400" role="alert">
            {error}
          </p>
        )}

        <button type="submit" disabled={submitting} className={btnPrimary}>
          {submitting ? 'Saving…' : 'Save application'}
        </button>
      </form>

      {duplicate && (
        <DuplicatePrompt
          existing={duplicate.existing}
          submitting={submitting}
          onCancel={() => setDuplicate(null)}
          onForce={() => {
            setDuplicate(null);
            submit(true);
          }}
        />
      )}
    </div>
  );
}

function DuplicatePrompt({
  existing,
  submitting,
  onCancel,
  onForce,
}: {
  existing: ApplicationResponse;
  submitting: boolean;
  onCancel: () => void;
  onForce: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-labelledby="dup-title"
      className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-5"
    >
      <h2 id="dup-title" className="font-medium text-amber-400">
        Looks like you already added this
      </h2>
      <p className="text-sm text-muted mt-2">
        We found a similar application:{' '}
        <strong className="text-text">
          {existing.company} · {existing.role}
        </strong>{' '}
        (applied {existing.appliedDate}).
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onForce}
          disabled={submitting}
          className={btnPrimary}
        >
          Add anyway
        </button>
        <Link
          href={`/tracker/${existing.id}`}
          className={btnSecondary}
        >
          View existing
        </Link>
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm text-muted">
        {label}
        {required && <span className="text-primary-lt"> *</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = cn(
  'w-full min-h-[44px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text',
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
