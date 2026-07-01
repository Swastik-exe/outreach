'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { CareerScoreResponse } from '@/lib/types';
import { ScoreRing } from '@/components/ScoreRing';
import { BandBadge } from '@/components/BandBadge';
import { ComponentBar } from '@/components/ComponentBar';
import { VortexLoader } from '@/components/VortexLoader';

const COMPONENT_KEYS = [
  'resume', 'applications', 'skills', 'profile', 'github', 'cgpa',
] as const;

const COMPONENT_META: Record<typeof COMPONENT_KEYS[number], { label: string; key: keyof CareerScoreResponse; max: number }> = {
  resume:       { label: 'Resume',       key: 'resumeScore',       max: 250 },
  applications: { label: 'Applications', key: 'applicationsScore', max: 200 },
  skills:       { label: 'Skills',       key: 'skillsScore',       max: 150 },
  profile:      { label: 'Profile',      key: 'profileScore',      max: 150 },
  github:       { label: 'GitHub',       key: 'githubScore',       max: 150 },
  cgpa:         { label: 'CGPA',         key: 'cgpaComponent',     max: 100 },
};

export default function DashboardPage() {
  const [score, setScore] = useState<CareerScoreResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchScore = async () => {
    const res = await api.get<CareerScoreResponse>('/career-score');
    if (res.success && res.data) {
      setScore(res.data);
      setError('');
    } else {
      setError(res.error ?? 'Failed to load score');
    }
  };

  useEffect(() => {
    fetchScore().finally(() => setLoading(false));
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    const res = await api.post<CareerScoreResponse>('/career-score/refresh');
    if (res.success && res.data) setScore(res.data);
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <VortexLoader label="Loading your readiness score…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-red-400 text-sm">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchScore().finally(() => setLoading(false)); }}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!score) return null;

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Career Readiness Score</h1>
        <p className="text-[#8B8FA8] text-sm mt-1">{score.readinessNote}</p>
      </div>

      {/* Main score card */}
      <div className="bg-[#111318] border border-[#2A2D36] rounded-2xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          {/* Ring */}
          <div className="shrink-0">
            <ScoreRing score={score.overallScore} band={score.band} size={248} />
          </div>

          {/* Meta */}
          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div className="space-y-2">
              <BandBadge band={score.band} bandRange={score.bandRange} size="lg" />
              {score.githubWeightRedistributed && (
                <p className="text-xs text-[#4B4F63]">
                  GitHub not connected — score redistributed across other components.
                </p>
              )}
            </div>

            {/* Next action */}
            {score.nextAction && (
              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-4">
                <p className="text-xs font-medium text-indigo-400 uppercase tracking-wider mb-1">
                  Highest-impact next step
                </p>
                <p className="text-sm text-[#F4F5F7]">{score.nextAction}</p>
              </div>
            )}

            {/* Framing for new users */}
            {score.overallScore < 301 && (
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4">
                <p className="text-sm text-amber-400">
                  <span className="font-medium">This is your starting point</span> — not a verdict.
                  One resume upload and 3 applications move you into &ldquo;Building&rdquo; territory.
                </p>
              </div>
            )}

            {/* Stale notice */}
            {score.stale && (
              <p className="text-xs text-[#4B4F63]">
                Score may be outdated (recalculates tonight at 02:00 IST).{' '}
                <button
                  onClick={handleRefresh}
                  className="text-indigo-400 hover:text-indigo-300 underline transition-colors"
                >
                  Refresh now
                </button>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="bg-[#111318] border border-[#2A2D36] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">Components</h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="text-xs text-[#8B8FA8] hover:text-[#F4F5F7] disabled:opacity-50 transition-colors px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Recalculate score"
          >
            {refreshing ? 'Updating…' : '↻ Recalculate'}
          </button>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          {COMPONENT_KEYS.map((key) => {
            const meta = COMPONENT_META[key];
            const value = score[meta.key] as number;
            return (
              <ComponentBar
                key={key}
                name={key}
                data={{ value, max: meta.max, upside: meta.max - value, reason: '', nextAction: null }}
              />
            );
          })}
        </div>

        {score.lastComputedAt && (
          <p className="text-xs text-[#4B4F63] mt-5">
            Last computed:{' '}
            {new Date(score.lastComputedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
          </p>
        )}
      </div>
    </div>
  );
}
