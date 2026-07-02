'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, apiUpload } from '@/lib/api';
import { pageContent } from '@/lib/page';
import { cn } from '@/lib/utils';
import { VortexLoader } from '@/components/VortexLoader';
import type { ResumeResponse, ResumeStatusResponse, SpringPage, UploadResponse } from '@/lib/types';

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const POLL_INTERVAL_MS = 2500;
const MAX_POLLS = 24; // 60 s
const TERMINAL_STATUSES = new Set(['done', 'done_basic', 'failed']);

const POLL_MESSAGES = [
  'Parsing your resume…',
  'Analysing content…',
  'Checking keywords…',
  'Scoring readiness…',
  'Finalising signals…',
  'Almost there…',
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function statusLabel(status: string) {
  switch (status) {
    case 'done':       return { text: 'Analysis complete', cls: 'text-emerald-400 bg-emerald-400/10' };
    case 'done_basic': return { text: 'Basic analysis',    cls: 'text-indigo-400 bg-indigo-400/10'  };
    case 'failed':     return { text: 'Failed',            cls: 'text-red-400 bg-red-400/10'        };
    case 'processing': return { text: 'Processing…',       cls: 'text-amber-400 bg-amber-400/10'    };
    default:           return { text: 'Pending',           cls: 'text-[#8B8FA8] bg-[#1A1D24]'      };
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Skeleton card ─────────────────────────────────────────────────────────────
function ResumeSkeleton() {
  return (
    <div className="bg-surface rounded-xl border border-border p-5 animate-pulse" aria-hidden="true">
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-surface2 rounded w-1/2" />
          <div className="h-3 bg-surface2 rounded w-1/3" />
        </div>
        <div className="h-6 w-24 bg-surface2 rounded-full" />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div className="h-8 w-16 bg-surface2 rounded" />
        <div className="h-8 w-24 bg-surface2 rounded-lg" />
      </div>
    </div>
  );
}

// ── Resume card ───────────────────────────────────────────────────────────────
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

  async function handleDelete() {
    if (!confirming) { setConfirming(true); return; }
    setDeleting(true);
    await api.del(`/resumes/${resume.id}`);
    onDelete(resume.id);
  }

  return (
    <article className="group bg-surface rounded-xl border border-border p-5 hover:border-primary/40 transition-colors">
      <div className="flex flex-wrap justify-between items-start gap-2">
        <div className="min-w-0">
          <h2 className="font-semibold text-text truncate">
            {resume.title ?? resume.fileName ?? 'Resume'}
          </h2>
          <p className="text-xs text-muted mt-0.5">
            {resume.fileName} &middot; Uploaded {fmtDate(resume.createdAt)}
          </p>
        </div>
        <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0', cls)}>
          {text}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
        {/* Readiness score */}
        <div>
          {isAnalysed && resume.readinessScore != null ? (
            <>
              <span className="font-mono text-3xl font-bold text-text">
                {resume.readinessScore}
              </span>
              <span className="text-muted text-sm ml-1">/ 100</span>
              <p className="text-xs text-muted mt-0.5">readiness signal</p>
            </>
          ) : resume.analysisStatus === 'failed' ? (
            <p className="text-sm text-red-400">Could not read PDF</p>
          ) : (
            <p className="text-sm text-muted italic">Analysing…</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {confirming ? (
            <>
              <span className="text-xs text-red-400">Delete?</span>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px]',
                  'bg-red-500/15 text-red-400 hover:bg-red-500/25',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500',
                )}
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                onClick={() => setConfirming(false)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px]',
                  'text-muted hover:text-text hover:bg-surface2',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                )}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              {isAnalysed && (
                <Link
                  href={`/resume/${resume.id}`}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex items-center',
                    'bg-indigo-500/15 text-indigo-400 hover:bg-indigo-500/25',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  )}
                >
                  View results
                </Link>
              )}
              {resume.analysisStatus === 'failed' && (
                <Link
                  href={`/resume/${resume.id}`}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors min-h-[44px] flex items-center',
                    'text-muted hover:text-text hover:bg-surface2',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                  )}
                >
                  Details
                </Link>
              )}
              <button
                onClick={handleDelete}
                aria-label={`Delete ${resume.title ?? resume.fileName ?? 'resume'}`}
                className={cn(
                  'px-3 py-2 rounded-lg text-xs font-medium transition-colors min-h-[44px]',
                  'text-dim hover:text-red-400 hover:bg-red-400/10',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500',
                )}
              >
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Upload drop zone ──────────────────────────────────────────────────────────
function UploadZone({ onFile }: { onFile: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files: FileList | null) {
    if (files && files[0]) onFile(files[0]);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload a PDF resume — click or drag and drop"
      onKeyDown={(e) => e.key === 'Enter' || e.key === ' ' ? inputRef.current?.click() : undefined}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
      className={cn(
        'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
        dragOver
          ? 'border-indigo-400 bg-indigo-500/5'
          : 'border-border hover:border-indigo-500/50 hover:bg-surface2/40',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="sr-only"
        onChange={(e) => handleFiles(e.target.files)}
        aria-hidden="true"
        tabIndex={-1}
      />
      <div className="text-4xl mb-3" aria-hidden="true">📄</div>
      <p className="font-semibold text-text">Drop your resume here or click to browse</p>
      <p className="text-sm text-muted mt-1">PDF only · max 5 MB</p>
    </div>
  );
}

// ── Polling overlay ───────────────────────────────────────────────────────────
function PollingOverlay({ message }: { message: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Analysing resume"
      className="fixed inset-0 z-50 bg-bg/90 backdrop-blur-sm flex flex-col items-center justify-center gap-6"
    >
      <VortexLoader size={56} label={message} />
      <p className="text-xs text-muted max-w-xs text-center">
        This usually takes 5–15 seconds. Stay on this page.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ResumePage() {
  const router = useRouter();
  const [resumes, setResumes] = useState<ResumeResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [pollMsg, setPollMsg] = useState(POLL_MESSAGES[0]);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const msgRef = useRef(0);

  const load = useCallback(async () => {
    const res = await api.get<SpringPage<ResumeResponse>>('/resumes?page=0&size=100');
    // #region agent log
    fetch('http://127.0.0.1:7803/ingest/1db6d770-9892-4152-aea8-958874f6587b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d0dbd5'},body:JSON.stringify({sessionId:'d0dbd5',location:'resume/page.tsx:load',message:'resume list loaded',data:{success:res.success,count:res.data?pageContent(res.data).length:0,errorCode:res.errorCode??null},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
    // #endregion
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

  // Message rotation during polling
  useEffect(() => {
    if (!polling) { msgRef.current = 0; return; }
    const interval = setInterval(() => {
      msgRef.current = (msgRef.current + 1) % POLL_MESSAGES.length;
      setPollMsg(POLL_MESSAGES[msgRef.current]);
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
    // Timeout — still navigate to results page so user can see partial state
    setPolling(false);
    router.push(`/resume/${resumeId}`);
  }

  async function handleFile(file: File) {
    setUploadError(null);

    // Client-side guards (first line of defence before server validates)
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

  return (
    <>
      {polling && <PollingOverlay message={pollMsg} />}

      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-space text-2xl font-bold text-text">Resume Readiness</h1>
            <p className="text-muted mt-1 text-sm">
              Upload your resume to get readiness signals — not a guarantee, a direction.
            </p>
          </div>
        </div>

        {/* Upload error */}
        {uploadError && (
          <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
            {uploadError}
            <button
              onClick={() => setUploadError(null)}
              className="ml-3 underline hover:no-underline text-xs"
              aria-label="Dismiss error"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-4">
            <ResumeSkeleton />
            <ResumeSkeleton />
            <ResumeSkeleton />
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div role="alert" className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && resumes.length === 0 && (
          <div className="bg-surface rounded-xl border border-border p-8 text-center">
            <div className="text-5xl mb-4" aria-hidden="true">📋</div>
            <h2 className="font-space font-semibold text-lg text-text">Upload your first resume</h2>
            <p className="text-muted text-sm mt-2 max-w-sm mx-auto">
              We&apos;ll scan it for readiness signals — keywords, impact, formatting — and show you
              the fastest improvements.
            </p>
            <div className="mt-6">
              <UploadZone onFile={handleFile} />
            </div>
          </div>
        )}

        {/* Upload zone (when resumes exist) */}
        {!loading && !error && resumes.length > 0 && (
          <section aria-label="Upload new resume">
            <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wider">
              Upload / Replace
            </h2>
            <UploadZone onFile={handleFile} />
          </section>
        )}

        {/* Active resume */}
        {!loading && activeResume && (
          <section aria-label="Active resume">
            <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wider flex items-center gap-2">
              Active Resume
              <span className="text-xs text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full font-normal normal-case">
                ● In use
              </span>
            </h2>
            <ResumeCard resume={activeResume} onDelete={handleDelete} />
          </section>
        )}

        {/* Other resumes */}
        {!loading && otherResumes.length > 0 && (
          <section aria-label="Previous resumes">
            <h2 className="text-sm font-medium text-muted mb-3 uppercase tracking-wider">Previous Versions</h2>
            <div className="space-y-3">
              {otherResumes.map((r) => (
                <ResumeCard key={r.id} resume={r} onDelete={handleDelete} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
