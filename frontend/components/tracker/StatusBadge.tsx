'use client';

import { cn } from '@/lib/utils';
import { getStatusMeta } from '@/lib/tracker';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = getStatusMeta(status);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        meta.color,
        meta.bg,
        meta.ring,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}
