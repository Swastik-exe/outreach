'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { BreakdownResponse } from '@/lib/types';
import { bandDisplayName } from '@/lib/types';
import {
  BAR_COLORS,
  ComponentBar,
  deriveComponentTag,
} from '@/components/ComponentBar';
import { VortexLoader } from '@/components/VortexLoader';

const COMPONENT_KEYS = [
  'applications',
  'resume',
  'skills',
  'profile',
  'github',
  'cgpa',
] as const;
type ComponentKey = (typeof COMPONENT_KEYS)[number];

export default function BreakdownPage() {
  const [data, setData] = useState<BreakdownResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get<BreakdownResponse>('/career-score/breakdown')
      .then((res) => {
        if (res.success && res.data) setData(res.data);
        else setError(res.error ?? 'Failed to load breakdown');
      })
      .finally(() => setLoading(false));
  }, []);

  const maxUpsideKey = useMemo(() => {
    if (!data) return null;
    let best: ComponentKey | null = null;
    let bestUpside = -1;
    for (const key of COMPONENT_KEYS) {
      const comp = data[key];
      if (comp && comp.upside > bestUpside) {
        bestUpside = comp.upside;
        best = key;
      }
    }
    return bestUpside > 0 ? best : null;
  }, [data]);

  const stackSegments = useMemo(() => {
    if (!data) return [];
    const parts = COMPONENT_KEYS.map((key) => {
      const comp = data[key];
      if (!comp || comp.value <= 0) return null;
      return { key, value: comp.value };
    }).filter(Boolean) as { key: ComponentKey; value: number }[];
    const total = parts.reduce((s, p) => s + p.value, 0) || 1;
    return parts.map((p) => ({
      key: p.key,
      width: (p.value / total) * 100,
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="max-w-score mx-auto w-full flex items-center justify-center min-h-[60vh]">
        <VortexLoader label="Loading breakdown…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-score mx-auto w-full flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-error text-sm">{error}</p>
        <Link href="/dashboard" className="text-primary-lt hover:text-[#C4B5FD] text-sm">
          ← Back
        </Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="max-w-score mx-auto w-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-end gap-3.5 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <h1 className="m-0 font-space font-semibold text-[21px]">
            Where your {data.overallScore} comes from
          </h1>
          <div className="text-[13px] text-dim mt-0.5">
            Six components, stale scores refresh overnight · every change explained in{' '}
            <Link
              href="/dashboard/history"
              className="text-primary-lt no-underline hover:text-[#C4B5FD]"
            >
              History
            </Link>
          </div>
        </div>
        <span
          className="inline-flex items-center gap-[7px] px-3 py-[5px] rounded-full whitespace-nowrap text-[12.5px] font-semibold border"
          style={{
            background: 'rgba(124,58,237,0.12)',
            borderColor: 'rgba(124,58,237,0.32)',
            color: '#A78BFA',
          }}
        >
          <span
            className="w-[7px] h-[7px] rounded-full bg-primary shrink-0"
            aria-hidden="true"
          />
          {bandDisplayName(data.band)} · {data.overallScore}/1000
        </span>
      </div>

      {/* Stacked contribution bar */}
      {stackSegments.length > 0 && (
        <div
          aria-hidden="true"
          className="flex h-2.5 rounded-[5px] overflow-hidden bg-card border border-border"
        >
          {stackSegments.map((seg, i) => (
            <span
              key={seg.key}
              className="h-full"
              style={{
                width: `${seg.width}%`,
                backgroundColor: BAR_COLORS[seg.key] ?? '#8B5CF6',
                opacity: i % 2 === 0 ? 1 : 0.85,
              }}
            />
          ))}
        </div>
      )}

      {/* Per-component cards */}
      <div className="flex flex-col gap-4">
        {COMPONENT_KEYS.map((key) => {
          const comp = data[key as ComponentKey];
          if (!comp) return null;
          const tag = deriveComponentTag(key, comp, maxUpsideKey);
          return (
            <div
              key={key}
              className="bg-card border border-border rounded-[14px] px-5 py-[18px]"
            >
              <ComponentBar
                name={key}
                data={comp}
                showDetail
                cardLayout
                tag={tag}
              />
            </div>
          );
        })}
      </div>

      {data.githubWeightRedistributed && (
        <p className="text-[12.5px] text-dim text-center max-w-[64ch] mx-auto mt-1">
          GitHub weight is redistributed across other components when GitHub is not connected — you can still reach 1000. Connecting GitHub switches to the GitHub component instead (requires a profile GitHub link when that UI ships).
        </p>
      )}

      <p className="text-[12.5px] text-dim text-center max-w-[64ch] mx-auto mt-1" style={{ textWrap: 'pretty' }}>
        Weights are fixed globally and never change mid-search. The score measures readiness
        signals — it can&apos;t see luck, referrals, or interview-day nerves, and we won&apos;t pretend it does.
      </p>
    </div>
  );
}
