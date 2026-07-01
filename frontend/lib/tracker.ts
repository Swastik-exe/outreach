import type { ApplicationResponse } from './types';

/** All app_status values from the backend enum. */
export const APP_STATUSES = [
  'applied',
  'pending_oa',
  'oa_submitted',
  'interview_scheduled',
  'interview_done',
  'technical_round',
  'hr_round',
  'shortlisted',
  'offer_received',
  'offer_accepted',
  'offer_declined',
  'rejected',
  'ghosted',
  'withdrawn',
] as const;

export type AppStatus = (typeof APP_STATUSES)[number];

export const TERMINAL_STATUSES = new Set<AppStatus>([
  'offer_accepted',
  'offer_declined',
  'rejected',
  'ghosted',
  'withdrawn',
]);

/** Journey-stage badge colours — stages, not failures. */
export const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; ring: string }
> = {
  applied: {
    label: 'Applied',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    ring: 'ring-amber-400/30',
  },
  pending_oa: {
    label: 'Pending OA',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    ring: 'ring-amber-400/30',
  },
  oa_submitted: {
    label: 'OA Submitted',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    ring: 'ring-orange-400/30',
  },
  interview_scheduled: {
    label: 'Interview Scheduled',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    ring: 'ring-indigo-400/30',
  },
  interview_done: {
    label: 'Interview Done',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    ring: 'ring-indigo-400/30',
  },
  technical_round: {
    label: 'Technical Round',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    ring: 'ring-indigo-400/30',
  },
  hr_round: {
    label: 'HR Round',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    ring: 'ring-indigo-400/30',
  },
  shortlisted: {
    label: 'Shortlisted',
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    ring: 'ring-indigo-400/30',
  },
  offer_received: {
    label: 'Offer Received',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    ring: 'ring-emerald-400/30',
  },
  offer_accepted: {
    label: 'Offer Accepted',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    ring: 'ring-emerald-400/30',
  },
  offer_declined: {
    label: 'Offer Declined',
    color: 'text-muted',
    bg: 'bg-surface2',
    ring: 'ring-border',
  },
  rejected: {
    label: 'Rejected',
    color: 'text-muted',
    bg: 'bg-surface2',
    ring: 'ring-border',
  },
  ghosted: {
    label: 'Ghosted',
    color: 'text-muted',
    bg: 'bg-surface2',
    ring: 'ring-border',
  },
  withdrawn: {
    label: 'Withdrawn',
    color: 'text-muted',
    bg: 'bg-surface2',
    ring: 'ring-border',
  },
};

export function getStatusMeta(status: string) {
  return STATUS_META[status] ?? {
    label: status.replace(/_/g, ' '),
    color: 'text-muted',
    bg: 'bg-surface2',
    ring: 'ring-border',
  };
}

export function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isFollowUpDue(app: ApplicationResponse, followUpIds: Set<string>) {
  return followUpIds.has(app.id);
}

export const OUTCOME_OPTIONS = [
  { value: 'interview_got', label: 'Got an interview' },
  { value: 'offer_got', label: 'Received an offer' },
  { value: 'rejected_after_interview', label: 'Rejected after interview' },
] as const;

export const PRIORITY_OPTIONS = ['low', 'medium', 'high'] as const;

export const SOURCE_OPTIONS = [
  { value: 'manual', label: 'Manual entry' },
  { value: 'forwarded_email', label: 'Forwarded email' },
] as const;
