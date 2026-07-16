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

const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 24;
const TERMINAL = new Set(['done', 'done_basic', 'failed']);

const ANALYZE_STEPS = [
  'Reading structure & sections',
  'Checking evidence in every bullet',
  'Matching keywords for your target role',
  'Writing your prioritized fixes',
];

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
    <div className="flex items-center gap-3">
      <span className="shrink-0 max-w-[32%] min-w-[128px] text-[13px] text-muted truncate">{label}</span>
      <span className="flex-1 h-[5px] rounded-sm bg-inner overflow-hidden">
        <span
          className="block h-full rounded-sm transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </span>
      <span className="shrink-0 font-mono text-[12.5px] text-text tabular-nums">
        {value ?? '—'}
        <span className="text-dim">/{max}</span>
      </span>
    </div>
  );
}

function ReadinessDisplay({ score, source, fileName }: { score: number | null; source: string | null; fileName: string | null }) {
  const isBasic = source === 'rule_based';
  const ringColor = '#7C3AED';
  const r = 49;
  const circ = 2 * Math.PI * r;
  const dash = score != null ? (score / 100) * circ * 0.71 : 0;

  return (
    <div className="flex gap-4 items-center">
      <div className="relative w-[116px] h-[116px] shrink-0">
        <svg width="116" height="116" viewBox="0 0 116 116" role="img" aria-label={`Resume readiness ${score ?? 'not available'} of 100`}>
          <circle cx="58" cy="58" r={r} fill="none" stroke="#22304A" strokeWidth="9" opacity="0.55" />
          <circle
            cx="58"
            cy="58"
            r={r}
            fill="none"
            stroke={ringColor}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform="rotate(-90 58 58)"
            style={{ transition: 'stroke-dasharray 1s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono font-bold text-[30px] leading-none text-primary-lt tabular-nums">
            {score ?? '—'}
          </span>
          <span className="font-mono text-[11px] text-dim mt-0.5">/100</span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-dim truncate">
          {fileName ?? 'Resume'}
        </div>
        {isBasic ? (
          <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full bg-primary/12 border border-primary/30 text-xs font-semibold text-primary-lt">
            Basic analysis
          </span>
        ) : source === 'ai' ? (
          <span className="inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full bg-success/10 border border-success/30 text-xs font-semibold text-success-lt">
            Strong for your target
          </span>
        ) : null}
      </div>
    </div>
  );
}

function GapChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12.5px] font-medium bg-amber/10 text-[#FDE68A] border border-amber/30">
      <span aria-hidden="true">+</span>
      {label}
    </span>
  );
}

function WarningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FB7185" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 8v5 M12 16.5v.01 M12 2.8 22 20H2Z" />
    </svg>
  );
}

export default function ResumeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [resume, setResume] = useState<ResumeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [quotaReached, setQuotaReached] = useState(false);
  const [pollStep, setPollStep] = useState(0);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef(0);

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
      if (r && !TERMINAL.has(r.analysisStatus)) {
        startPolling();
      }
    })();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (!polling) { stepRef.current = 0; setPollStep(0); return; }
    const interval = setInterval(() => {
      stepRef.current = Math.min(stepRef.current + 1, ANALYZE_STEPS.length - 1);
      setPollStep(stepRef.current);
    }, 3000);
    return () => clearInterval(interval);
  }, [polling]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <VortexLoader size="xl" label="Loading resume…" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 max-w-content mx-auto">
        <p className="text-error text-sm">{error}</p>
        <Link href="/resume" className="mt-4 inline-block text-sm text-primary-lt hover:underline">
          Back to resumes
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
    <div className="w-full max-w-content mx-auto flex flex-col gap-4">
      <Link
        href="/resume"
        className="inline-flex items-center gap-1.5 text-sm text-dim hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
      >
        All resumes
      </Link>

      <div className="flex items-end gap-3.5 flex-wrap">
        <div className="flex-1 min-w-[220px]">
          <h1 className="m-0 font-space font-semibold text-[21px] text-text">Resume analyzer</h1>
          <div className="text-[13px] text-dim mt-0.5">
            {resume.fileName}
            {resume.analyzedAt && (
              <> · analyzed {new Date(resume.analyzedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</>
            )}
            {resume.targetRole && <> · targeting {resume.targetRole}</>}
          </div>
        </div>
      </div>

      {(isProcessing || polling) && (
        <section
          aria-label="Analyzing resume"
          className="bg-card border border-border rounded-2xl min-h-[320px] flex flex-col items-center justify-center gap-5 px-6 py-10"
        >
          <VortexLoader
            size="xl"
            label={`Analyzing ${resume.fileName ?? 'resume'}…`}
          />
          <div className="flex flex-col gap-2 min-w-[min(360px,100%)]">
            {ANALYZE_STEPS.map((label, i) => (
              <div
                key={label}
                className={cn(
                  'flex items-center gap-2.5 text-[13.5px]',
                  i < pollStep ? 'text-muted' : i === pollStep ? 'text-text' : 'text-dim',
                )}
              >
                {i < pollStep ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4.5 12.5l5 5L19.5 7" />
                  </svg>
                ) : i === pollStep ? (
                  <span className="w-3.5 h-3.5 flex items-center justify-center">
                    <span className="w-[7px] h-[7px] rounded-full bg-primary" />
                  </span>
                ) : (
                  <span className="w-3.5 h-3.5 flex items-center justify-center">
                    <span className="w-[5px] h-[5px] rounded-full bg-hover-border" />
                  </span>
                )}
                {label}
              </div>
            ))}
          </div>
          <div className="text-[12.5px] text-dim">Usually 20–30 seconds. You can leave — we&apos;ll save the result.</div>
        </section>
      )}

      {isFailed && !polling && (
        <section
          aria-label="Analysis failed"
          className="bg-card border border-border rounded-2xl px-6 py-11 flex flex-col items-center text-center"
        >
          <span className="w-11 h-11 rounded-xl bg-error/14 flex items-center justify-center">
            <WarningIcon />
          </span>
          <h2 className="mt-3.5 mb-1 font-space font-semibold text-[17px] text-text">
            We couldn&apos;t read that file
          </h2>
          <p className="m-0 mb-4 text-sm text-muted max-w-[52ch] text-pretty">
            This usually happens with scanned or image-only PDFs — documents that contain pictures of text rather than actual text. Export from your editor as a text PDF and try again.
          </p>
          <div className="flex gap-2.5 flex-wrap justify-center">
            <Link
              href="/resume"
              className="h-11 px-[18px] rounded-[10px] bg-primary text-white text-sm font-semibold flex items-center hover:bg-primary-hover transition-colors"
            >
              Try another file
            </Link>
            <Link
              href="/resume"
              className="h-11 px-4 rounded-[10px] border border-border bg-surface text-text text-[13.5px] font-semibold flex items-center hover:border-hover-border transition-colors"
            >
              Back to all resumes
            </Link>
          </div>
        </section>
      )}

      {quotaReached && (
        <UpgradePrompt
          feature="resume analyses"
          lockedPreview="Keyword gap: system design · Impact score: 78 · Top fix: Quantify achievements with metrics"
        />
      )}

      {analyzeError && (
        <div role="alert" className="bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-sm text-error">
          {analyzeError}
        </div>
      )}

      {isAnalysed && !polling && (
        <>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 items-start">
            <section aria-label="Readiness score" className="bg-card border border-border rounded-2xl p-[22px] flex flex-col gap-4">
              <ReadinessDisplay
                score={resume.readinessScore}
                source={resume.analysisSource}
                fileName={resume.fileName}
              />
              <div className="flex flex-col gap-2.5 border-t border-border pt-3.5">
                <ScoreMeter label="Keyword match" value={resume.keywordScore} max={100} color="#8B5CF6" />
                <ScoreMeter label="Impact & achievements" value={resume.impactScore} max={100} color="#F59E0B" />
                <ScoreMeter label="Formatting" value={resume.formattingScore} max={100} color="#2DD4BF" />
              </div>
              <div className="flex gap-2.5 items-start bg-surface border border-inner rounded-[10px] px-3 py-2.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 mt-0.5">
                  <path d="M12 21a9 9 0 1 0-9-9 9 9 0 0 0 9 9Z M12 11v5 M12 8v.01" />
                </svg>
                <span className="text-[12.5px] text-muted text-pretty">
                  These are readiness signals based on common screening patterns — not any company&apos;s real ATS. No tool can promise an interview; this one won&apos;t pretend to.
                </span>
              </div>
            </section>

            {resume.keywordGaps && resume.keywordGaps.length > 0 && (
              <section aria-label="Keyword coverage" className="bg-card border border-border rounded-2xl p-[22px] flex flex-col gap-3.5">
                <div>
                  <h2 className="m-0 font-space font-semibold text-[15px] text-text">Keyword coverage</h2>
                  <div className="text-[12.5px] text-dim mt-0.5">
                    {resume.targetRole
                      ? `vs. recent postings for ${resume.targetRole}`
                      : 'Skills commonly expected for your target role'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-semibold text-success-lt mb-2">FOUND · from your resume</div>
                  <p className="text-[12.5px] text-dim">Matched keywords appear in your analysis breakdown.</p>
                </div>
                <div>
                  <div className="text-xs font-semibold text-amber mb-2">
                    WORTH ADDING · {resume.keywordGaps.length}
                    <span className="font-normal text-dim"> — only if true for you</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {resume.keywordGaps.map((gap) => (
                      <GapChip key={gap} label={gap} />
                    ))}
                  </div>
                </div>
                <div className="text-[12.5px] text-dim border-t border-inner pt-3">
                  Never add a skill you can&apos;t back up in an interview — honesty scores higher everywhere that matters.
                </div>
              </section>
            )}
          </div>

          {fixes.length > 0 && (
            <section aria-label="Prioritized fixes" className="bg-card border border-border rounded-2xl p-[22px]">
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <h2 className="m-0 font-space font-semibold text-[15px] text-text">Fixes, in order of impact</h2>
                <span className="ml-auto text-[12.5px] text-dim">Sorted by expected impact</span>
              </div>
              <div className="flex flex-col mt-1.5">
                {fixes.map((fix, i) => (
                  <div
                    key={i}
                    className={cn('flex gap-3.5 py-4 flex-wrap', i > 0 && 'border-t border-inner')}
                  >
                    <span className="shrink-0 w-[26px] h-[26px] rounded-lg bg-primary/14 text-primary-lt flex items-center justify-center font-mono text-[13px] font-semibold">
                      {i + 1}
                    </span>
                    <span className="flex-1 min-w-[300px] text-sm text-text leading-relaxed">{fix}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {fixes.length === 0 && (resume.keywordGaps?.length ?? 0) === 0 && (
            <div className="bg-card border border-success/30 rounded-2xl p-5 text-center">
              <p className="text-sm text-success-lt font-medium">Looking strong! No major gaps detected.</p>
              <p className="text-xs text-dim mt-1">Keep updating your resume as your experience grows.</p>
            </div>
          )}

          <section className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-text">Re-analyse after updates</p>
              <p className="text-xs text-dim">Counts toward your free analysis quota</p>
            </div>
            {!quotaReached ? (
              <button
                onClick={handleAnalyze}
                disabled={analyzing}
                className={cn(
                  'px-4 py-2 rounded-[10px] text-sm font-semibold min-h-[44px] transition-colors',
                  'bg-primary text-white hover:bg-primary-hover',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                {analyzing ? 'Analysing…' : 'Re-analyse'}
              </button>
            ) : (
              <span className="text-xs text-amber bg-amber/10 border border-amber/30 px-3 py-1.5 rounded-full font-semibold">
                Quota reached
              </span>
            )}
          </section>
        </>
      )}
    </div>
  );
}
