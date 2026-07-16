'use client';

import { getBandMeta, bandDisplayName } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BandBadgeProps {
  band: string;
  bandRange?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BandBadge({ band, bandRange, size = 'md' }: BandBadgeProps) {
  const meta = getBandMeta(band);
  const label = bandDisplayName(band);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-[7px] rounded-full font-semibold whitespace-nowrap border',
        size === 'sm' && 'px-2.5 py-1 text-xs',
        size === 'md' && 'px-3 py-[5px] text-[12.5px]',
        size === 'lg' && 'px-3 py-[5px] text-[12.5px]',
      )}
      style={{
        background: meta.chipBg,
        borderColor: meta.chipBd,
        color: meta.text,
      }}
    >
      <span
        className="inline-block w-[7px] h-[7px] rounded-full shrink-0"
        style={{ backgroundColor: meta.accent }}
        aria-hidden="true"
      />
      {label}
      {bandRange && (
        <span className="opacity-60 font-normal">({bandRange})</span>
      )}
    </span>
  );
}
