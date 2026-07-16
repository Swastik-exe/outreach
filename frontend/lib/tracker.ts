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

/** Journey-stage badge colours — never error red for normal statuses. */
export const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; ring: string }
> = {
  applied: {
    label: 'Applied',
    color: 'text-primary-lt',
    bg: 'bg-primary/10',
    ring: 'ring-primary/30',
  },
  pending_oa: {
    label: 'Pending OA',
    color: 'text-amber',
    bg: 'bg-amber/10',
    ring: 'ring-amber/30',
  },
  oa_submitted: {
    label: 'OA Submitted',
    color: 'text-amber',
    bg: 'bg-amber/10',
    ring: 'ring-amber/30',
  },
  interview_scheduled: {
    label: 'Interview Scheduled',
    color: 'text-teal',
    bg: 'bg-teal/10',
    ring: 'ring-teal/30',
  },
  interview_done: {
    label: 'Interview Done',
    color: 'text-teal',
    bg: 'bg-teal/10',
    ring: 'ring-teal/30',
  },
  technical_round: {
    label: 'Technical Round',
    color: 'text-teal',
    bg: 'bg-teal/10',
    ring: 'ring-teal/30',
  },
  hr_round: {
    label: 'HR Round',
    color: 'text-teal',
    bg: 'bg-teal/10',
    ring: 'ring-teal/30',
  },
  shortlisted: {
    label: 'Shortlisted',
    color: 'text-teal',
    bg: 'bg-teal/10',
    ring: 'ring-teal/30',
  },
  offer_received: {
    label: 'Offer Received',
    color: 'text-success-lt',
    bg: 'bg-success/10',
    ring: 'ring-success/30',
  },
  offer_accepted: {
    label: 'Offer Accepted',
    color: 'text-success-lt',
    bg: 'bg-success/10',
    ring: 'ring-success/30',
  },
  offer_declined: {
    label: 'Offer Declined',
    color: 'text-muted',
    bg: 'bg-inner',
    ring: 'ring-border',
  },
  rejected: {
    label: 'Closed',
    color: 'text-muted',
    bg: 'bg-inner',
    ring: 'ring-border',
  },
  ghosted: {
    label: 'Quiet',
    color: 'text-muted',
    bg: 'bg-inner',
    ring: 'ring-border',
  },
  withdrawn: {
    label: 'Withdrawn',
    color: 'text-muted',
    bg: 'bg-inner',
    ring: 'ring-border',
  },
};

export function getStatusMeta(status: string) {
  return (
    STATUS_META[status] ?? {
      label: status.replace(/_/g, ' '),
      color: 'text-muted',
      bg: 'bg-inner',
      ring: 'ring-border',
    }
  );
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
