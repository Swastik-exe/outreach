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
  const confColor =
    confidencePct != null && confidencePct >= 80
      ? { text: '#34D399', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.3)' }
      : { text: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };

  return (
    <section
      aria-label="Imported draft"
      className="flex flex-col gap-3 rounded-[14px] border border-border bg-card px-5 py-[18px]"
    >
      <div className="flex flex-wrap items-start gap-3">
        <span className="min-w-[200px] flex-1">
          <span className="block text-[15px] font-semibold text-text">
            {draft.parsedCompany ?? 'Unknown company'}
            {draft.parsedRole && (
              <span className="font-normal text-dim"> · {draft.parsedRole}</span>
            )}
          </span>
          <span className="mt-0.5 block text-[12.5px] text-dim">
            Parsed date: {fmtDate(draft.parsedDate)}
            {confidencePct != null && ` · ${confidencePct}% match`}
          </span>
        </span>
        {confidencePct != null && (
          <span
            className="inline-flex items-center rounded-full px-[11px] py-1 text-xs font-semibold whitespace-nowrap"
            style={{
              color: confColor.text,
              backgroundColor: confColor.bg,
              border: `1px solid ${confColor.border}`,
            }}
          >
            {confidencePct}% match
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">Company</span>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className={inputCls}
            aria-label="Edit company"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">Role</span>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={inputCls}
            aria-label="Edit role"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-muted">Applied date</span>
          <input
            type="date"
            value={appliedDate}
            onChange={(e) => setAppliedDate(e.target.value)}
            className={inputCls}
            aria-label="Edit applied date"
          />
        </label>
      </div>

      {draft.needsReview && (
        <div className="rounded-[10px] border border-inner bg-bg px-[13px] py-2.5 text-[13px] italic text-muted">
          Review suggested — please verify company and role before approving.
        </div>
      )}

      {error && (
        <p className="text-sm text-amber" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy != null}
          className={btnPrimary}
        >
          {busy === 'confirm' ? 'Adding…' : 'Approve — add to tracker'}
        </button>
        <button
          type="button"
          onClick={handleDiscard}
          disabled={busy != null}
          className={btnGhost}
        >
          {busy === 'discard' ? 'Discarding…' : 'Dismiss'}
        </button>
      </div>
    </section>
  );
}

const inputCls = cn(
  'h-11 w-full rounded-[10px] border border-border bg-card px-3 text-sm text-text',
  'focus-visible:outline-none focus-visible:border-primary',
);

const btnPrimary = cn(
  'inline-flex h-10 items-center justify-center rounded-[10px] px-4',
  'text-[13.5px] font-semibold text-white bg-primary transition-colors',
  'hover:bg-primary-hover disabled:opacity-50',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);

const btnGhost = cn(
  'inline-flex h-10 items-center justify-center rounded-[10px] px-3.5',
  'text-[13.5px] font-medium text-muted transition-colors',
  'hover:bg-card hover:text-text disabled:opacity-50',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
);
