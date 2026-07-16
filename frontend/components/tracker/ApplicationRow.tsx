'use client';

import Link from 'next/link';
import { StatusBadge } from '@/components/tracker/StatusBadge';
import { fmtDate } from '@/lib/tracker';
import type { ApplicationResponse } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ApplicationRowProps {
  app: ApplicationResponse;
  showFollowUp?: boolean;
}

function lastActivity(app: ApplicationResponse): string {
  if (app.nextAction) return app.nextAction;
  const timeline = app.timeline ?? [];
  if (timeline.length > 0) {
    const latest = [...timeline].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )[0];
    if (latest?.notes) return latest.notes;
  }
  if (app.notes) return app.notes;
  return `Applied ${fmtDate(app.appliedDate)}`;
}

function dueLabel(app: ApplicationResponse, showFollowUp?: boolean): string {
  if (showFollowUp) return 'Follow up now';
  if (app.nextActionDue) return `Due ${fmtDate(app.nextActionDue)}`;
  return '';
}

function dueColor(showFollowUp?: boolean, status?: string): string {
  if (showFollowUp) return '#F59E0B';
  if (status && ['offer_received', 'offer_accepted'].includes(status)) return '#34D399';
  if (
    status &&
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
  if (status && ['pending_oa', 'oa_submitted'].includes(status)) return '#F59E0B';
  if (status && ['applied'].includes(status)) return '#A78BFA';
  return '#64748B';
}

export function ApplicationRow({ app, showFollowUp }: ApplicationRowProps) {
  const due = dueLabel(app, showFollowUp);
  const dueC = dueColor(showFollowUp, app.currentStatus);

  return (
    <Link
      href={`/tracker/${app.id}`}
      className={cn(
        'flex w-full flex-wrap items-center gap-3.5 px-5 py-[15px] text-left transition-colors sm:gap-3.5',
        'hover:bg-row-hover',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset',
      )}
    >
      <span className="min-w-0 flex-[1_1_200px]">
        <span className="block truncate text-[14.5px] font-semibold text-text">
          {app.company}
        </span>
        <span className="block truncate text-[12.5px] text-dim">{app.role}</span>
      </span>
      <StatusBadge status={app.currentStatus} className="shrink-0" />
      <span className="min-w-[140px] flex-[2_1_180px] truncate text-[13px] text-muted">
        {lastActivity(app)}
      </span>
      {due && (
        <span
          className="min-w-[104px] shrink-0 text-right text-[12.5px] font-semibold whitespace-nowrap"
          style={{ color: dueC }}
        >
          {due}
        </span>
      )}
    </Link>
  );
}
