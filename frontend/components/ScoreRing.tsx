'use client';

import { useEffect, useRef } from 'react';
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
const CIRC = 2 * Math.PI * R;
const COUNT_MS = 220;

/**
 * Dashboard score ring — count-up drives number + stroke via direct DOM writes
 * (no React re-render per frame). Do NOT add a competing CSS ring-draw.
 */
export function ScoreRing({ score, band, size = VIEW }: ScoreRingProps) {
  const meta = getBandMeta(band);
  const arcRef = useRef<SVGCircleElement>(null);
  const numRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const target = Math.max(0, Math.min(1000, Math.round(score)));
    const arc = arcRef.current;
    const num = numRef.current;
    if (!arc || !num) return;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const paint = (v: number) => {
      const dash = (v / 1000) * CIRC;
      arc.setAttribute('stroke-dasharray', `${dash.toFixed(1)} ${CIRC.toFixed(1)}`);
      num.textContent = String(Math.round(v));
    };

    if (reduced || COUNT_MS <= 0) {
      paint(target);
      return;
    }

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);

    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / COUNT_MS);
      paint(target * ease(p));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [score]);

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
          ref={arcRef}
          cx={VIEW / 2}
          cy={VIEW / 2}
          r={R}
          fill="none"
          stroke={meta.accent}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={`0 ${CIRC.toFixed(1)}`}
          transform={`rotate(-90 ${VIEW / 2} ${VIEW / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-px">
        <div
          ref={numRef}
          className="font-mono font-bold tabular-nums leading-none"
          style={{ fontSize: 52, color: meta.text }}
        >
          0
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
