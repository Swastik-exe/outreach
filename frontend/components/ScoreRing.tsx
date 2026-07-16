'use client';

import { useCountUp } from '@/hooks/useCountUp';
import { getBandMeta } from '@/lib/types';

interface ScoreRingProps {
  score: number;
  band: string;
  size?: number;
}

/** Design ring: r=89, stroke=11, viewBox 204 — circumference ≈ 559.2 */
const R = 89;
const STROKE = 11;
const VIEW = 204;
const CIRC = 2 * Math.PI * R; // ≈ 559.2

/**
 * Dashboard/onboarding ring — JS count-up drives both number and stroke-dasharray.
 * Do NOT add a competing CSS ring-draw animation here.
 */
export function ScoreRing({ score, band, size = VIEW }: ScoreRingProps) {
  const displayed = useCountUp(score, 220);
  const meta = getBandMeta(band);
  const dash = Math.max(0, (displayed / 1000) * CIRC);

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Career health score ${score} of 1000. Band: ${band}`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${VIEW} ${VIEW}`} aria-hidden="true">
        <circle
          cx={VIEW / 2}
          cy={VIEW / 2}
          r={R}
          fill="none"
          stroke="#22304A"
          strokeWidth={STROKE}
          opacity={0.55}
        />
        <circle
          cx={VIEW / 2}
          cy={VIEW / 2}
          r={R}
          fill="none"
          stroke={meta.accent}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(1)} ${CIRC.toFixed(1)}`}
          transform={`rotate(-90 ${VIEW / 2} ${VIEW / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
        <div
          className="font-mono font-bold tabular-nums leading-none"
          style={{ fontSize: 52, color: meta.text }}
        >
          {displayed}
        </div>
        <div
          className="font-mono text-dim tabular-nums"
          style={{ fontSize: 12.5, marginTop: 6 }}
        >
          of 1000
        </div>
      </div>
    </div>
  );
}
