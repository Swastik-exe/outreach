'use client';

import { cn } from '@/lib/utils';
import { getStatusMeta } from '@/lib/tracker';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

type JourneyStage = 'saved' | 'applied' | 'assessment' | 'interview' | 'offer' | 'closed';

const JOURNEY_STYLES: Record<
  JourneyStage,
  { text: string; dot: string; bg: string; border: string }
> = {
  saved: {
    text: '#A5B4C3',
    dot: '#64748B',
    bg: 'rgba(100,116,139,0.12)',
    border: 'rgba(100,116,139,0.3)',
  },
  applied: {
    text: '#A78BFA',
    dot: '#8B5CF6',
    bg: 'rgba(139,92,246,0.12)',
    border: 'rgba(139,92,246,0.3)',
  },
  assessment: {
    text: '#F59E0B',
    dot: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
  },
  interview: {
    text: '#2DD4BF',
    dot: '#2DD4BF',
    bg: 'rgba(45,212,191,0.12)',
    border: 'rgba(45,212,191,0.32)',
  },
  offer: {
    text: '#34D399',
    dot: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
    border: 'rgba(16,185,129,0.3)',
  },
  closed: {
    text: '#A5B4C3',
    dot: '#64748B',
    bg: 'rgba(100,116,139,0.12)',
    border: 'rgba(100,116,139,0.3)',
  },
};

function statusToJourney(status: string): JourneyStage {
  if (['rejected', 'ghosted', 'withdrawn', 'offer_declined'].includes(status)) {
    return 'closed';
  }
  if (['offer_received', 'offer_accepted'].includes(status)) {
    return 'offer';
  }
  if (
    [
      'interview_scheduled',
      'interview_done',
      'technical_round',
      'hr_round',
      'shortlisted',
    ].includes(status)
  ) {
    return 'interview';
  }
  if (['pending_oa', 'oa_submitted'].includes(status)) {
    return 'assessment';
  }
  return 'applied';
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const meta = getStatusMeta(status);
  const journey = statusToJourney(status);
  const style = JOURNEY_STYLES[journey];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-[11px] py-1 text-xs font-semibold whitespace-nowrap',
        className,
      )}
      style={{
        color: style.text,
        backgroundColor: style.bg,
        border: `1px solid ${style.border}`,
      }}
    >
      <span
        aria-hidden="true"
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: style.dot }}
      />
      {meta.label}
    </span>
  );
}
