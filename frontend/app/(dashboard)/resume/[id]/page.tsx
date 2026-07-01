'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { UpgradePrompt } from '@/components/billing/UpgradePrompt';
import { VortexLoader } from '@/components/VortexLoader';
import type { ResumeResponse, ResumeStatusResponse } from '@/lib/types';
import { parseFixes } from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────
const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 24;
const TERMINAL = new Set(['done', 'done_basic', 'failed']);

// ── Score meter ───────────────────────────────────────────────────────────────
function ScoreMeter({
  label,
  value,
  max = 100,
  color,
}: {
  label: string;
  value: number | null;
  max?: number;
  color: string;
}) {
  const pct = value != null ? Math.round((value / max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline">
        <span className="text-sm text-muted">{label}</span>
        <span className="font-mono text-lg font-semibold text-text tabular-nums">
          {value ?? '—'}
          <span className="text-xs text-muted font-normal">/{max}</span>
        </span>
      </div>
      <div className="h-2 bg-surface2 rounded-full overflow-hidden" role="presentation">
        <div
          className={cn('h-full rounded-full transition-all duration-700', color)}
          style={{ width: `${pct}%` }}
          aria-label={`${label}: ${value ?? 0} out of ${max}`}
        />
      </div>
    </div>
  );
}

// ── Readiness ring (big number) ───────────────────────────────────────────────
function ReadinessDisplay({ score, source }: { score: number | null; source: string | null }) {
  const isBasic = source === 'rule_based';
  const color =
    score == null ? '#4B4F63'
    : score >= 75 ? '#34D399'
    : score >= 50 ? '#818CF8'
    : score >= 30 ? '#FB923C'
    : '#F59E0B';

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-40 h-40">
        <svg viewBox="0 0 160 160" className="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="80" cy="80" r="68" stroke="#1A1D24" strokeWidth="14" fill="none" />
          <circle
            cx="80"
            cy="80"
            r="68"
            stroke={color}
            strokeWidth="14"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 68}`}
            strokeDashoffset={`${2 * Math.PI * 68 * (1 - (score ?? 0) / 100)}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="font-mono text-4xl font-bold text-text tabular-nums"
            aria-label={`Readiness score: ${score ?? 'not available'} out of 100`}
          >
            {score ?? '—'}
          </span>
          <span className="text-xs text-muted">/ 100</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-muted">Resume readiness signal</p>
        {isBasic && (
          <span className="mt-1 inline-block text-xs px-2.5 py-0.5 rounded-full bg-indigo-400/10 text-indigo-400">
            Basic analysis (AI unavailable)
          </span>
        )}
        {source === 'ai' && (
          <span className="mt-1 inline-block text-xs px-2.5 py-0.5 rounded-full bg-emerald-400/10 text-emerald-400">
            AI-powered analysis
          </span>
        )}
      </div>
    </div>
  );
}

// ── Keyword gap chip ──────────────────────────────────────────────────────────
function GapChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-400/10 text-amber-400 border border-amber-400/20">
      <span aria-hidden="true">+</span>
      {label}
    </span>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ResumeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [resume, setResume] = useState<ResumeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [quotaReached, setQuotaReached] = useState(false);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResume = useCallback(async () => {
    const res = await api.get<ResumeResponse>(`/resumes/${id}`);
    if (res.success && res.data) {
      setResume(res.data);
      return res.data;
    } else {
      setError(res.error ?? 'Could not load resume.');
      return null;
    }
  }, [id]);

  useEffect(() => {
    (async () => {
      const r = await fetchResume();
      setLoading(false);
      // If it arrived in a processing state, start polling
      if (r && !TERMINAL.has(r.analysisStatus)) {
        startPolling();
      }
    })();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function startPolling() {
    setPolling(true);
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => { pollRef.current = setTimeout(r, POLL_INTERVAL_MS); });
      const res = await api.get<ResumeStatusResponse>(`/resumes/${id}/status`);
      if (res.success && res.data && TERMINAL.has(res.data.analysisStatus)) {
        setPolling(false);
        await fetchResume();
        return;
      }
    }
    // Timeout — just refresh whatever state exists
    setPolling(false);
    await fetchResume();
  }

  async function handleAnalyze() {
    setAnalyzeError(null);
    setAnalyzing(true);
    const res = await api.post<ResumeResponse>(`/resumes/${id}/analyze`);
    setAnalyzing(false);
    if (res.success && res.data) {
      setResume(res.data);
      setQuotaReached(false);
    } else if (res.error?.toLowerCase().includes('quota')) {
      setQuotaReached(true);
    } else {
      setAnalyzeError(res.error ?? 'Analysis failed. Please try again.');
    }
  }

  // ── Render states ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <VortexLoader label="Loading resume…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-red-400 text-sm">{error}</p>
        <Link href="/resume" className="mt-4 inline-block text-sm text-indigo-400 hover:underline">
          ← Back to resumes
        </Link>
      </div>
    );
  }

  if (!resume) return null;

  const fixes = parseFixes(resume.aiFixes);
  const isAnalysed = resume.analysisStatus === 'done' || resume.analysisStatus === 'done_basic';
  const isFailed = resume.analysisStatus === 'failed';
  const isProcessing = !TERMINAL.has(resume.analysisStatus);

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {/* Back */}
      <Link
        href="/resume"
        className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
      >
        <span aria-hidden="true">←</span> All resumes
      </Link>

      {/* Header */}
      <div className="bg-surface rounded-xl border border-border p-6">
        <h1 className="font-space text-xl font-bold text-text">
          {resume.title ?? resume.fileName ?? 'Resume'}
        </h1>
        <p className="text-muted text-sm mt-1">
          {resume.fileName}
          {resume.analyzedAt && (
            <> · Analysed {new Date(resume.analyzedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>
          )}
          {resume.targetRole && (
            <> · Target: <span className="text-text">{resume.targetRole}</span></>
          )}
        </p>
      </div>

      {/* ── Processing state ── */}
      {(isProcessing || polling) && (
        <div className="bg-surface rounded-xl border border-amber-500/20 p-8 flex flex-col items-center gap-4">
          <VortexLoader label="Analysing your resume…" />
          <p className="text-sm text-muted text-center max-w-xs">
            This usually takes 5–15 seconds. Scores will appear here once ready.
          </p>
        </div>
      )}

      {/* ── Failed state ── */}
      {isFailed && !polling && (
        <div
          role="alert"
          className="bg-surface rounded-xl border border-red-500/20 p-6 space-y-3"
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl" aria-hidden="true">⚠️</span>
            <div>
              <h2 className="font-semibold text-text">We couldn&apos;t read this PDF</h2>
              <p className="text-sm text-muted mt-1">
                This usually happens with scanned or image-only PDFs — documents that contain
                pictures of text rather than actual text. Our parser needs a text-based PDF.
              </p>
              <p className="text-sm text-muted mt-2">
                <strong className="text-text">To fix this:</strong> Open your resume in Microsoft
                Word or Google Docs and export it as PDF. Most word-processor exports produce
                text-readable PDFs.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-border">
            <Link
              href="/resume"
              className="text-sm text-indigo-400 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded"
            >
              ← Upload a different resume
            </Link>
          </div>
        </div>
      )}

      {/* ── Quota state ── */}
      {quotaReached && (
        <UpgradePrompt
          feature="resume analyses"
          lockedPreview="Keyword gap: system design · Impact score: 78 · Top fix: Quantify achievements with metrics"
        />
      )}

      {/* ── Analyse error ── */}
      {analyzeError && (
        <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
          {analyzeError}
        </div>
      )}

      {/* ── Results ── */}
      {isAnalysed && !polling && (
        <>
          {/* Readiness + disclaimer */}
          <div className="bg-surface rounded-xl border border-border p-6 flex flex-col items-center gap-4">
            <ReadinessDisplay score={resume.readinessScore} source={resume.analysisSource} />
            <p className="text-xs text-dim text-center max-w-xs">
              This is a <strong className="text-muted">readiness signal</strong>, not a prediction of
              interview outcomes. Use it to focus your next improvement, not as a verdict.
            </p>
          </div>

          {/* Sub-scores */}
          <section aria-label="Score breakdown" className="bg-surface rounded-xl border border-border p-6 space-y-5">
            <h2 className="font-semibold text-text">Score Breakdown</h2>
            <ScoreMeter label="Keyword match" value={resume.keywordScore} color="bg-indigo-500" />
            <ScoreMeter label="Impact & achievements" value={resume.impactScore} color="bg-emerald-500" />
            <ScoreMeter label="Formatting" value={resume.formattingScore} color="bg-amber-500" />
          </section>

          {/* Keyword gaps */}
          {resume.keywordGaps && resume.keywordGaps.length > 0 && (
            <section aria-label="Missing keywords" className="bg-surface rounded-xl border border-border p-6 space-y-4">
              <div>
                <h2 className="font-semibold text-text">Missing Keywords</h2>
                <p className="text-xs text-muted mt-0.5">
                  {resume.analysisSource === 'rule_based'
                    ? 'Keywords commonly expected for your target role, detected as absent from your resume.'
                    : 'Skills and keywords your resume is missing for this role.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2" role="list" aria-label="Missing keyword chips">
                {resume.keywordGaps.map((gap) => (
                  <div key={gap} role="listitem">
                    <GapChip label={gap} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Prioritised fixes */}
          {fixes.length > 0 && (
            <section aria-label="Recommended improvements" className="bg-surface rounded-xl border border-border p-6 space-y-4">
              <div>
                <h2 className="font-semibold text-text">Recommended Improvements</h2>
                <p className="text-xs text-muted mt-0.5">
                  Sorted by expected impact. These are readiness signals, not rules —
                  use your judgement.
                </p>
              </div>
              <ol className="space-y-3 list-none" role="list">
                {fixes.map((fix, i) => (
                  <li key={i} className="flex gap-3 items-start" role="listitem">
                    <span
                      aria-hidden="true"
                      className="shrink-0 w-6 h-6 rounded-full bg-indigo-500/15 text-indigo-400 text-xs flex items-center justify-center font-semibold mt-0.5"
                    >
                      {i + 1}
                    </span>
                    <p className="text-sm text-text leading-relaxed">{fix}</p>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Empty fixes */}
          {fixes.length === 0 && (resume.keywordGaps?.length ?? 0) === 0 && (
            <div className="bg-surface rounded-xl border border-emerald-500/20 p-5 text-center">
              <p className="text-sm text-emerald-400 font-medium">
                Looking strong! No major gaps detected.
              </p>
              <p className="text-xs text-muted mt-1">
                Keep updating your resume as your experience grows.
              </p>
            </div>
          )}

          {/* Re-analyse CTA */}
          <div className="flex items-center justify-between bg-surface rounded-xl border border-border p-4">
            <div>
              <p className="text-sm font-medium text-text">Re-analyse after updates</p>
              <p className="text-xs text-muted">Counts toward your free analysis quota (3 total)</p>
            </div>
            {!quotaReached ? (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className={cn(
                  'px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] transition-colors',
                  'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {analyzing ? 'Analysing…' : 'Re-analyse'}
              </button>
            ) : (
              <span className="text-xs text-amber-400 bg-amber-400/10 px-3 py-1.5 rounded-full">
                Quota reached
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
