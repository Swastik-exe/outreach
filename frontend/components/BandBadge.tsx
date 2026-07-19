'use client';

import { getBandMeta, bandDisplayName } from '@/lib/types';
import { cn } from '@/lib/utils';

interface BandBadgeProps {
  band: string;
}

export function BandBadge({ band }: BandBadgeProps) {
  const meta = getBandMeta(band);
  const label = bandDisplayName(band);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-[7px] rounded-full font-semibold whitespace-nowrap border',
        'px-3 py-[5px] text-[12.5px]',
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
    </span>
  );
}
