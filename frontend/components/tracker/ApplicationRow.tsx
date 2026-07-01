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

export function ApplicationRow({ app, showFollowUp }: ApplicationRowProps) {
  return (
    <Link
      href={`/tracker/${app.id}`}
      className={cn(
        'block rounded-xl border border-border bg-surface p-4 sm:p-5 transition-colors',
        'hover:border-primary/40 hover:bg-surface2/50',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-medium text-text truncate">{app.company}</h2>
          <p className="text-sm text-muted truncate">{app.role}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <StatusBadge status={app.currentStatus} />
          <span className="text-xs text-muted">{fmtDate(app.appliedDate)}</span>
          {showFollowUp && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-orange-400/10 text-orange-400 ring-1 ring-inset ring-orange-400/30">
              Follow-up due
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
