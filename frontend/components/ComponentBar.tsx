'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { ComponentBreakdown } from '@/lib/types';

const COMPONENT_LABELS: Record<string, { label: string; max: number }> = {
  applications: { label: 'Applications & momentum', max: 200 },
  resume:       { label: 'Resume readiness',       max: 250 },
  skills:       { label: 'Skills evidence',        max: 150 },
  profile:      { label: 'Profile completeness',    max: 150 },
  github:       { label: 'GitHub',                 max: 150 },
  cgpa:         { label: 'CGPA',                   max: 100 },
};

const BAR_COLORS: Record<string, string> = {
  applications: '#8B5CF6',
  resume:       '#7C3AED',
  skills:       '#2DD4BF',
  profile:      '#F59E0B',
  github:       '#2DD4BF',
  cgpa:         '#F59E0B',
};

const CTA_MAP: Record<string, { label: string; href: string }> = {
  resume:       { label: 'Open Resume',  href: '/resume' },
  applications: { label: 'Open Tracker', href: '/tracker' },
  skills:       { label: 'Open Resume',  href: '/resume' },
  profile:      { label: 'Open Tracker', href: '/tracker' },
};

function rgba(hex: string, alpha: number) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface ComponentTag {
  label: string;
  color: string;
}

interface ComponentBarProps {
  name: string;
  data: ComponentBreakdown | null;
  showDetail?: boolean;
  tag?: ComponentTag | null;
  /** When true, renders the full card header + footer layout for breakdown page. */
  cardLayout?: boolean;
}

export function ComponentBar({
  name,
  data,
  showDetail = false,
  tag,
  cardLayout = false,
}: ComponentBarProps) {
  const meta = COMPONENT_LABELS[name] ?? { label: name, max: 100 };
  const value = data?.value ?? 0;
  const max = data?.max ?? meta.max;
  const pct = max > 0 ? (value / max) * 100 : 0;
  const barColor = BAR_COLORS[name] ?? '#8B5CF6';
  const cta = CTA_MAP[name] ?? { label: 'View', href: '/dashboard' };

  const bar = (
    <div
      className="h-1.5 rounded-[3px] bg-inner overflow-hidden"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${meta.label}: ${value} of ${max}`}
    >
      <div
        className="h-full rounded-[3px] transition-[width] duration-150 ease-out"
        style={{ width: `${pct}%`, backgroundColor: barColor }}
      />
    </div>
  );

  if (cardLayout && showDetail && data) {
    return (
      <section aria-label={meta.label}>
        <div className="flex items-center gap-3 flex-wrap">
          <h2 className="m-0 font-space font-semibold text-[15.5px]">{meta.label}</h2>
          {tag && (
            <span
              className="inline-flex items-center px-2.5 py-[3px] rounded-full whitespace-nowrap text-[11.5px] font-semibold border"
              style={{
                background: rgba(tag.color, 0.12),
                borderColor: rgba(tag.color, 0.3),
                color: tag.color === '#8B5CF6' ? '#A78BFA' : tag.color,
              }}
            >
              {tag.label}
            </span>
          )}
          <span className="ml-auto font-mono text-[15px] font-semibold text-text tabular-nums">
            {value}
            <span className="text-dim text-[12.5px]">/{max}</span>
          </span>
        </div>

        <div className="mt-3">{bar}</div>

        {data.reason && (
          <p className="mt-3 mb-0 text-[13.5px] text-muted max-w-[76ch]" style={{ textWrap: 'pretty' }}>
            <span className="text-dim font-semibold">Why: </span>
            {data.reason}
          </p>
        )}

        {data.nextAction && (
          <div className="flex gap-3 items-center mt-3 pt-3 border-t border-inner flex-wrap">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#A78BFA"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className="flex-none"
            >
              <path d="M13 2 4.5 13.5h6L11 22l8.5-11.5h-6L13 2Z" />
            </svg>
            <span className="flex-1 min-w-[200px] text-[13.5px] text-text">{data.nextAction}</span>
            {data.upside > 0 && (
              <span className="font-mono text-[13px] font-semibold text-success-lt tabular-nums">
                +{data.upside}
              </span>
            )}
            <Link
              href={cta.href}
              className="text-[13px] font-semibold text-primary-lt no-underline px-2 py-1.5 rounded-lg hover:text-[#C4B5FD] hover:bg-surface transition-colors duration-150"
            >
              {cta.label} →
            </Link>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-text">{meta.label}</span>
        <span className="font-mono text-muted tabular-nums">
          {value}
          <span className="text-dim">/{max}</span>
        </span>
      </div>

      <div
        className={cn('h-2 rounded-full bg-inner overflow-hidden')}
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={`${meta.label}: ${value} of ${max}`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-150 ease-out"
          style={{ width: `${pct}%`, backgroundColor: barColor }}
        />
      </div>

      {showDetail && data && (
        <div className="pt-1 space-y-1">
          {data.reason && (
            <p className="text-xs text-muted">
              <span className="text-dim font-semibold">Why: </span>
              {data.reason}
            </p>
          )}
          {data.nextAction && (
            <p className="text-xs text-primary-lt flex items-start gap-1.5">
              <span aria-hidden="true" className="mt-px shrink-0">→</span>
              <span>{data.nextAction}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function deriveComponentTag(
  key: string,
  data: ComponentBreakdown,
  maxUpsideKey: string | null,
): ComponentTag {
  const pct = data.max > 0 ? (data.value / data.max) * 100 : 0;
  if (key === maxUpsideKey && data.upside > 0) {
    return { label: 'Biggest lever', color: '#F59E0B' };
  }
  if (data.upside >= 10) {
    return { label: 'Quick wins here', color: '#F59E0B' };
  }
  if (pct >= 60) {
    return { label: 'On pace', color: '#8B5CF6' };
  }
  if (pct >= 40) {
    return { label: 'Growing', color: '#2DD4BF' };
  }
  return { label: 'Room to grow', color: '#64748B' };
}

export { BAR_COLORS };
