'use client';

import { useCountUp } from '@/hooks/useCountUp';
import { getBandMeta } from '@/lib/types';

interface ScoreRingProps {
  score: number;
  band: string;
  size?: number;
}

const RADIUS = 110;
const STROKE_WIDTH = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SVG_SIZE = (RADIUS + STROKE_WIDTH + 4) * 2;

export function ScoreRing({ score, band, size = SVG_SIZE }: ScoreRingProps) {
  const displayed = useCountUp(score, 1200);
  const meta = getBandMeta(band);

  const progress = Math.min(score / 1000, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  const gradId = `score-grad-${band.replace(/\s/g, '-')}`;

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Career readiness score: ${score} out of 1000. Band: ${band}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        fill="none"
        aria-hidden="true"
        style={{ transform: 'rotate(-90deg)' }}
      >
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={meta.accent} stopOpacity="0.6" />
            <stop offset="100%" stopColor={meta.accent} />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle
          cx={SVG_SIZE / 2}
          cy={SVG_SIZE / 2}
          r={RADIUS}
          stroke="#1A1D24"
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />

        {/* Progress arc */}
        <circle
          cx={SVG_SIZE / 2}
          cy={SVG_SIZE / 2}
          r={RADIUS}
          stroke={`url(#${gradId})`}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          fill="none"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono text-5xl font-bold tabular-nums leading-none"
          style={{ color: meta.accent }}
        >
          {displayed}
        </span>
        <span className="text-sm text-[#8B8FA8] mt-1 font-medium tracking-widest uppercase">
          / 1000
        </span>
      </div>
    </div>
  );
}
