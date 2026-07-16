'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, apiUpload } from '@/lib/api';
import { pageContent } from '@/lib/page';
import { cn } from '@/lib/utils';
import { VortexLoader } from '@/components/VortexLoader';
import type { ResumeResponse, ResumeStatusResponse, SpringPage, UploadResponse } from '@/lib/types';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 24;
const TERMINAL_STATUSES = new Set(['done', 'done_basic', 'failed']);

const POLL_MESSAGES = [
  'Reading structure & sections',
  'Checking evidence in every bullet',
  'Matching keywords for your target role',
  'Writing your prioritized fixes',
];

const POLL_STEPS = [
  'Reading structure & sections',
  'Checking evidence in every bullet',
  'Matching keywords for your target role',
  'Writing your prioritized fixes',
];

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 16V4 M7 9l5-5 5 5 M4 20h16" />
    </svg>
  );
}

function statusLabel(status: string) {
  switch (status) {
    case 'done':       return { text: 'Analysis complete', cls: 'text-success-lt bg-success/10 border-success/30' };
    case 'done_basic': return { text: 'Basic analysis',    cls: 'text-primary-lt bg-primary/12 border-primary/30' };
    case 'failed':     return { text: 'Failed',            cls: 'text-error bg-error/14 border-error/30' };
    case 'processing': return { text: 'Processing…',       cls: 'text-amber bg-amber/10 border-amber/30' };
    default:           return { text: 'Pending',           cls: 'text-dim bg-surface border-border' };
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ResumeSkeleton() {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 animate-pulse" aria-hidden="true">
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-inner rounded w-1/2" />
          <div className="h-3 bg-inner rounded w-1/3" />
        </div>
        <div className="h-6 w-24 bg-inner rounded-full" />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div className="h-8 w-16 bg-inner rounded" />
        <div className="h-8 w-24 bg-inner rounded-lg" />
      </div>
    </div>
  );
}

function ResumeCard({
  resume,
  onDelete,
}: {
  resume: ResumeResponse;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { text, cls } = statusLabel(resume.analysisStatus);
  const isAnalysed = resume.analysisStatus === 'done' || resume.analysisStatus === 'done_basic';
  const scoreColor = resume.active ? 'text-primary-lt' : 'text-text';

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    await api.del(`/resumes/${resume.id}`);
    onDelete(resume.id);
  }

  return (
    <div className="flex items-center gap-3 py-2.5 flex-wrap group">
      <span className={cn('shrink-0 font-mono text-[12.5px] font-semibold tabular-nums', scoreColor)}>
        {isAnalysed && resume.readinessScore != null ? resume.readinessScore : '—'}
      </span>
      <span className="flex-1 min-w-[160px] text-[13.5px] text-text">
        {resume.title ?? resume.fileName ?? 'Resume'}
        <span className="text-dim text-[12.5px]"> · {fmtDate(resume.createdAt)}</span>
      </span>
      <span className={cn('shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full border', cls)}>
        {text}
      </span>
      <span className="shrink-0 flex items-center gap-2">
        {confirming ? (
          <>
            <span className="text-xs text-error">Delete?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] bg-error/14 text-error hover:bg-error/20 focus-visible:ring-2 focus-visible:ring-error"
            >
              {deleting ? 'Deleting…' : 'Yes'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold min-h-[36px] text-muted hover:text-text hover:bg-surface"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {(isAnalysed || resume.analysisStatus === 'failed') && (
              <Link
                href={`/resume/${resume.id}`}
                className="px-3.5 py-2 rounded-[10px] text-[13px] font-semibold min-h-[40px] flex items-center border border-border bg-surface text-text hover:border-hover-border transition-colors"
              >
                {isAnalysed ? 'View results' : 'Details'}
              </Link>
            )}
            <button
              onClick={handleDelete}
              aria-label={`Delete ${resume.title ?? resume.fileName ?? 'resume'}`}
              className="px-3 py-2 rounded-lg text-xs font-medium min-h-[40px] text-dim hover:text-error hover:bg-error/10"
            >
              Delete
            </button>
          </>
        )}
      </span>
    </div>
  );
}

function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files: FileList | null) {
    if (files && files[0]) onFile(files[0]);
  }

  return (
    <section
      aria-label="Upload your resume"
      className={cn(
        'bg-card border-[1.5px] border-dashed rounded-2xl px-6 py-[52px] flex flex-col items-center text-center transition-colors',
        dragOver ? 'border-primary bg-primary/5' : 'border-hover-border',
      )}
    >
      <span className="w-12 h-12 rounded-[14px] bg-primary/14 flex items-center justify-center">
        <UploadIcon className="text-primary-lt" />
      </span>
      <h2 className="mt-4 mb-1 font-space font-semibold text-[17px] text-text">Drop your resume here</h2>
      <p className="m-0 mb-[18px] text-sm text-muted max-w-[46ch] text-pretty">
        PDF or DOCX, up to 5 MB. You&apos;ll get a readiness score and the exact fixes that raise it — usually in under 30 seconds.
      </p>
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? inputRef.current?.click() : undefined}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        className="h-11 px-[18px] rounded-[10px] bg-primary text-white text-sm font-semibold cursor-pointer hover:bg-primary-hover active:bg-primary-active transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
      >
        Choose a file
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="mt-4 text-xs text-dim">Your file is analyzed and stored privately. Delete it anytime.</div>
    </section>
  );
}

function PollingOverlay({ message, step }: { message: string; step: number }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Analyzing resume"
      className="fixed inset-0 z-50 bg-bg/92 flex items-center justify-center p-4"
    >
      <section className="bg-card border border-border rounded-2xl min-h-[320px] w-full max-w-lg flex flex-col items-center justify-center gap-5 px-6 py-10">
        <VortexLoader size="xl" label={message} />
        <div className="flex flex-col gap-2 min-w-[min(360px,100%)]">
          {POLL_STEPS.map((label, i) => (
            <div
              key={label}
              className={cn(
                'flex items-center gap-2.5 text-[13.5px]',
                i < step ? 'text-muted' : i === step ? 'text-text' : 'text-dim',
              )}
            >
              {i < step ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4.5 12.5l5 5L19.5 7" />
                </svg>
              ) : i === step ? (
                <span aria-hidden="true" className="w-3.5 h-3.5 flex items-center justify-center">
                  <span className="w-[7px] h-[7px] rounded-full bg-primary" />
                </span>
              ) : (
                <span aria-hidden="true" className="w-3.5 h-3.5 flex items-center justify-center">
                  <span className="w-[5px] h-[5px] rounded-full bg-hover-border" />
                </span>
              )}
              {label}
            </div>
          ))}
        </div>
        <div className="text-[12.5px] text-dim">Usually 20–30 seconds. You can leave — we&apos;ll save the result.</div>
      </section>
    </div>
  );
}

export default function ResumePage() {
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollMsg, setPollMsg] = useState(POLL_MESSAGES[0]);
  const [pollStep, setPollStep] = useState(0);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgRef = useRef(0);

  const load = useCallback(async () => {
    const res = await api.get<SpringPage<ResumeResponse>>('/resumes?page=0&size=100');
    if (res.success && res.data) {
      setResumes(pageContent(res.data));
    } else {
      setError(res.error ?? 'Could not load resumes.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    return () => { if (pollRef.current) clearTimeout(pollRef.current); };
  }, [load]);

  useEffect(() => {
    if (!polling) { msgRef.current = 0; setPollStep(0); return; }
    const interval = setInterval(() => {
      msgRef.current = (msgRef.current + 1) % POLL_MESSAGES.length;
      setPollMsg(POLL_MESSAGES[msgRef.current]);
      setPollStep((s) => Math.min(s + 1, POLL_STEPS.length - 1));
    }, 3000);
    return () => clearInterval(interval);
  }, [polling]);

  async function pollUntilDone(resumeId: string) {
    setPolling(true);
    for (let i = 0; i < MAX_POLLS; i++) {
      await new Promise((r) => { pollRef.current = setTimeout(r, POLL_INTERVAL_MS); });
      const res = await api.get<ResumeStatusResponse>(`/resumes/${resumeId}/status`);
      if (res.success && res.data && TERMINAL_STATUSES.has(res.data.analysisStatus)) {
        setPolling(false);
        router.push(`/resume/${resumeId}`);
        return;
      }
    }
    setPolling(false);
    router.push(`/resume/${resumeId}`);
  }

  async function handleFile(file: File) {
    setUploadError(null);
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are accepted. Please choose a .pdf file.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 5 MB.`);
      return;
    }

    const fd = new FormData();
    fd.append('file', file);
    const res = await apiUpload<UploadResponse>('/resumes/upload', fd);

    if (!res.success || !res.data) {
      setUploadError(res.error ?? 'Upload failed. Please try again.');
      return;
    }

    pollUntilDone(res.data.resumeId);
  }

  function handleDelete(id: string) {
    setResumes((prev) => prev.filter((r) => r.id !== id));
  }

  const activeResume = resumes.find((r) => r.active);
  const otherResumes = resumes.filter((r) => !r.active);

  const subline = loading
    ? 'Loading…'
    : error
      ? 'Could not load resumes'
      : resumes.length === 0
        ? 'No resume yet — your first upload is the fastest score gain available'
        : `${resumes.length} version${resumes.length === 1 ? '' : 's'} analyzed · readiness signals, not a company ATS`;

  return (
    <>
      {polling && <PollingOverlay message={pollMsg} step={pollStep} />}

      <div className="w-full max-w-content mx-auto flex flex-col gap-4">
        <div className="flex items-end gap-3.5 flex-wrap">
          <div className="flex-1 min-w-[220px]">
            <h1 className="m-0 font-space font-semibold text-[21px] text-text">Resume analyzer</h1>
            <div className="text-[13px] text-dim mt-0.5">{subline}</div>
          </div>
          {!loading && resumes.length > 0 && (
            <label className="inline-flex items-center gap-2 h-11 px-[18px] rounded-[10px] bg-primary text-white text-sm font-semibold cursor-pointer hover:bg-primary-hover active:bg-primary-active transition-colors whitespace-nowrap">
              <UploadIcon className="w-[15px] h-[15px]" />
              Upload new version
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
          )}
        </div>

        {uploadError && (
          <div role="alert" className="bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-sm text-error flex items-start justify-between gap-3">
            <span>{uploadError}</span>
            <button onClick={() => setUploadError(null)} className="text-xs underline hover:no-underline shrink-0" aria-label="Dismiss error">
              Dismiss
            </button>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <ResumeSkeleton />
            <ResumeSkeleton />
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="bg-error/10 border border-error/30 rounded-xl px-5 py-4 text-sm text-error">
            {error}
          </div>
        )}

        {!loading && !error && resumes.length === 0 && (
          <UploadZone onFile={handleFile} />
        )}

        {!loading && (activeResume || otherResumes.length > 0) && (
          <section aria-label="Versions" className="bg-card border border-border rounded-[14px] px-5 py-[18px]">
            <h2 className="m-0 mb-1 font-space font-semibold text-[15px] text-text">Versions</h2>
            <div className="flex flex-col">
              {activeResume && (
                <ResumeCard resume={activeResume} onDelete={handleDelete} />
              )}
              {otherResumes.map((r) => (
                <div key={r.id} className="border-t border-inner">
                  <ResumeCard resume={r} onDelete={handleDelete} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
