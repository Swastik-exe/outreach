'use client';

import { getBandMeta } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BandBadgeProps {
  band: string;
  bandRange?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BandBadge({ band, bandRange, size = 'md' }: BandBadgeProps) {
  const meta = getBandMeta(band);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium tracking-wide',
        meta.bg,
        meta.color,
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        size === 'lg' && 'px-4 py-1.5 text-base',
      )}
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: meta.accent }}
        aria-hidden="true"
      />
      {band}
      {bandRange && (
        <span className="opacity-60 font-normal">({bandRange})</span>
      )}
    </span>
  );
}
