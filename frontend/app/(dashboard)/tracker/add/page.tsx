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
    <div className="mx-auto flex max-w-[520px] flex-col gap-4">
      <header>
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
        <h1 className="mt-2 font-space text-[17px] font-semibold text-text">
          Add application
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Company" required>
          <input
            required
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={inputCls}
            placeholder="e.g. Razorpay"
          />
        </Field>

        <Field label="Role" required>
          <input
            required
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputCls}
            placeholder="e.g. SDE Intern"
          />
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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

          <Field label="Applied on" required>
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
            className={cn(inputCls, 'min-h-[88px] resize-y py-2.5')}
            placeholder="Optional context — referral, recruiter name, etc."
          />
        </Field>

        {error && (
          <p className="text-sm text-amber" role="alert">
            {error}
          </p>
        )}

        <div className="mt-1 flex gap-2.5">
          <button type="submit" disabled={submitting} className={cn(btnPrimary, 'flex-1 h-[46px]')}>
            {submitting ? 'Saving…' : 'Add application'}
          </button>
          <Link href="/tracker" className={btnCancel}>
            Cancel
          </Link>
        </div>
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
      className="rounded-[14px] border border-amber/40 bg-amber/5 p-5"
    >
      <h2 id="dup-title" className="font-semibold text-amber">
        Looks like you already added this
      </h2>
      <p className="mt-2 text-sm text-muted">
        We found a similar application:{' '}
        <strong className="text-text">
          {existing.company} · {existing.role}
        </strong>{' '}
        (applied {existing.appliedDate}).
      </p>
      <div className="mt-4 flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={onForce}
          disabled={submitting}
          className={btnPrimary}
        >
          Add anyway
        </button>
        <Link href={`/tracker/${existing.id}`} className={btnSecondary}>
          View existing
        </Link>
        <button type="button" onClick={onCancel} className={btnCancel}>
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
      <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">
        {label}
        {required && <span className="text-primary-lt"> *</span>}
      </span>
      {children}
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
  'h-11 w-full rounded-[10px] border border-border bg-card px-3 text-sm text-text',
  'focus-visible:outline-none focus-visible:border-primary',
);

const btnPrimary = cn(
  'inline-flex items-center justify-center rounded-[10px] px-4',
  'text-sm font-semibold text-white bg-primary transition-colors',
  'hover:bg-primary-hover disabled:opacity-50',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);

const btnSecondary = cn(
  'inline-flex h-10 items-center justify-center rounded-[10px] border border-border bg-bg px-4',
  'text-[13.5px] font-semibold text-text transition-colors',
  'hover:border-hover-border',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);

const btnCancel = cn(
  'inline-flex h-[46px] items-center justify-center rounded-[10px] border border-border px-[18px]',
  'text-sm font-semibold text-muted transition-colors',
  'hover:border-hover-border hover:text-text',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);
