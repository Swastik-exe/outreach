'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/tracker';
import type { ConfirmDraftRequest, InboundDraftResponse } from '@/lib/types';
import { cn } from '@/lib/utils';

interface DraftCardProps {
  draft: InboundDraftResponse;
  onResolved: (id: string) => void;
}

export function DraftCard({ draft, onResolved }: DraftCardProps) {
  const [company, setCompany] = useState(draft.parsedCompany ?? '');
  const [role, setRole] = useState(draft.parsedRole ?? '');
  const [appliedDate, setAppliedDate] = useState(draft.parsedDate ?? '');
  const [busy, setBusy] = useState<'confirm' | 'discard' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy('confirm');
    setError(null);
    const body: ConfirmDraftRequest = {
      company: company.trim() || undefined,
      role: role.trim() || undefined,
      appliedDate: appliedDate || undefined,
    };
    const res = await api.post<import('@/lib/types').CreateApplicationResult>(
      `/inbound-email/drafts/${draft.id}/confirm`,
      body,
    );
    setBusy(null);
    if (!res.success) {
      setError(res.error ?? 'Could not confirm this draft.');
      return;
    }
    onResolved(draft.id);
  }

  async function handleDiscard() {
    setBusy('discard');
    setError(null);
    const res = await api.post<void>(`/inbound-email/drafts/${draft.id}/discard`);
    setBusy(null);
    if (!res.success) {
      setError(res.error ?? 'Could not discard this draft.');
      return;
    }
    onResolved(draft.id);
  }

  const confidencePct =
    draft.confidence != null ? Math.round(Number(draft.confidence) * 100) : null;

  return (
    <article
      className={cn(
        'rounded-xl border bg-surface p-4 sm:p-5',
        draft.needsReview ? 'border-amber-400/40' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium text-text">
            {draft.parsedCompany ?? 'Unknown company'}
            {draft.parsedRole ? ` · ${draft.parsedRole}` : ''}
          </h3>
          <p className="text-sm text-muted mt-1">
            Parsed date: {fmtDate(draft.parsedDate)}
            {confidencePct != null && ` · ${confidencePct}% confidence`}
          </p>
        </div>
        {draft.needsReview && (
          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-amber-400/10 text-amber-400 ring-1 ring-inset ring-amber-400/30">
            Review suggested
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs text-muted">Company</span>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={inputCls}
            aria-label="Edit company"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Role</span>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputCls}
            aria-label="Edit role"
          />
        </label>
        <label className="block">
          <span className="text-xs text-muted">Applied date</span>
          <input
            type="date"
            value={appliedDate}
            onChange={(e) => setAppliedDate(e.target.value)}
            className={inputCls}
            aria-label="Edit applied date"
          />
        </label>
      </div>

      {error && (
        <p className="mt-3 text-sm text-orange-400" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy != null}
          className={btnPrimary}
        >
          {busy === 'confirm' ? 'Adding…' : 'Confirm & add'}
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={busy != null}
          className={btnSecondary}
        >
          {busy === 'discard' ? 'Discarding…' : 'Discard'}
        </button>
      </div>
    </article>
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
  'border border-border text-muted hover:text-text hover:bg-surface2 disabled:opacity-50 transition-colors',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);
