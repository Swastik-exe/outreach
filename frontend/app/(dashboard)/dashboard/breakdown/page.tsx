'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { BreakdownResponse } from '@/lib/types';
import { BandBadge } from '@/components/BandBadge';
import { ComponentBar } from '@/components/ComponentBar';
import { VortexLoader } from '@/components/VortexLoader';

const COMPONENT_KEYS = ['resume', 'applications', 'skills', 'profile', 'github', 'cgpa'] as const;
type ComponentKey = typeof COMPONENT_KEYS[number];

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <VortexLoader label="Loading breakdown…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-red-400 text-sm">{error}</p>
        <Link href="/dashboard" className="text-indigo-400 hover:text-indigo-300 text-sm">← Back</Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Score Breakdown</h1>
          <p className="text-[#8B8FA8] text-sm mt-1">{data.readinessNote}</p>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-2">
          <span className="font-mono text-3xl font-bold text-white tabular-nums">
            {data.overallScore}
            <span className="text-[#4B4F63] text-lg">/1000</span>
          </span>
          <BandBadge band={data.band} size="sm" />
        </div>
      </div>

      {/* Top next action */}
      {data.nextAction && (
        <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
          <p className="text-xs font-medium text-indigo-400 uppercase tracking-wider mb-1">
            Your single highest-impact action
          </p>
          <p className="text-sm text-[#F4F5F7]">{data.nextAction}</p>
        </div>
      )}

      {/* Per-component detail cards */}
      <div className="space-y-4">
        {COMPONENT_KEYS.map((key) => {
          const comp = data[key as ComponentKey];
          if (!comp) return null;
          return (
            <div
              key={key}
              className="bg-[#111318] border border-[#2A2D36] rounded-xl p-5"
            >
              <ComponentBar name={key} data={comp} showDetail />
            </div>
          );
        })}
      </div>

      {data.githubWeightRedistributed && (
        <p className="text-xs text-[#4B4F63] text-center">
          GitHub score redistributed — connect GitHub in your profile to unlock that component.
        </p>
      )}
    </div>
  );
}
