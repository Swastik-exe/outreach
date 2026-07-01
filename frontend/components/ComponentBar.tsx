'use client';

import { cn } from '@/lib/utils';
import type { ComponentBreakdown } from '@/lib/types';

const COMPONENT_LABELS: Record<string, { label: string; max: number }> = {
  resume:       { label: 'Resume',       max: 250 },
  applications: { label: 'Applications', max: 200 },
  skills:       { label: 'Skills',       max: 150 },
  profile:      { label: 'Profile',      max: 150 },
  github:       { label: 'GitHub',       max: 150 },
  cgpa:         { label: 'CGPA',         max: 100 },
};

interface ComponentBarProps {
  name: string;
  data: ComponentBreakdown | null;
  showDetail?: boolean;
}

export function ComponentBar({ name, data, showDetail = false }: ComponentBarProps) {
  const meta = COMPONENT_LABELS[name] ?? { label: name, max: 100 };
  const value = data?.value ?? 0;
  const max = data?.max ?? meta.max;
  const pct = max > 0 ? (value / max) * 100 : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-[#F4F5F7]">{meta.label}</span>
        <span className="font-mono text-[#8B8FA8] tabular-nums">
          {value}
          <span className="text-[#4B4F63]">/{max}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="h-2 rounded-full bg-[#1A1D24] overflow-hidden"
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${meta.label}: ${value} of ${max}`}
      >
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {showDetail && data && (
        <div className="pt-1 space-y-1">
          {data.reason && (
            <p className="text-xs text-[#8B8FA8]">{data.reason}</p>
          )}
          {data.nextAction && (
            <p className="text-xs text-indigo-400 flex items-start gap-1.5">
              <span aria-hidden="true" className="mt-px shrink-0">→</span>
              <span>{data.nextAction}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
