'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquarePlus, X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

type FeedbackType = 'bug' | 'feature';

export function FeedbackFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  const screen = pathname ?? '/';

  const reset = useCallback(() => {
    setMessage('');
    setType('bug');
    setStatus('idle');
    setError(null);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    reset();
  }, [reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus('loading');
    setError(null);
    const res = await api.post('/feedback', { message: message.trim(), screen, type });
    if (res.success) {
      setStatus('success');
      setTimeout(() => close(), 1200);
    } else {
      setStatus('error');
      setError(res.error ?? 'Failed to send feedback');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'fixed z-50 flex items-center gap-2 rounded-full shadow-lg',
          'bg-primary hover:bg-primary-hover text-white font-medium text-sm',
          'min-h-[44px] px-4 py-2',
          'bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
          'motion-safe:transition-colors',
        )}
        aria-label="Report bug or request feature"
      >
        <MessageSquarePlus className="w-5 h-5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-bg/70"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 id="feedback-title" className="text-lg font-semibold font-space text-text">
                Report bug / Request feature
              </h2>
              <button
                type="button"
                onClick={close}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-muted hover:text-text hover:bg-surface focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {status === 'success' ? (
              <p className="text-success-lt py-4 text-center" role="status">
                Thanks — we got your feedback!
              </p>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <p className="text-xs text-dim">
                  Screen: <span className="font-mono text-text">{screen}</span>
                </p>

                <div className="flex gap-2" role="group" aria-label="Feedback type">
                  {(['bug', 'feature'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        'flex-1 min-h-[44px] rounded-lg text-sm font-medium capitalize',
                        'focus-visible:ring-2 focus-visible:ring-primary',
                        type === t
                          ? 'bg-primary text-white'
                          : 'bg-surface text-muted hover:text-text border border-border',
                      )}
                    >
                      {t === 'bug' ? 'Bug' : 'Feature'}
                    </button>
                  ))}
                </div>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={4}
                  maxLength={5000}
                  placeholder="What happened? What would you like to see?"
                  className="w-full rounded-[10px] bg-surface border border-border px-3 py-2.5 text-sm text-text placeholder-dim focus:outline-none focus:ring-2 focus:ring-primary resize-y min-h-[100px]"
                />

                {error && (
                  <p className="text-sm text-error" role="alert">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading' || !message.trim()}
                  className="w-full min-h-[44px] rounded-[10px] bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium focus-visible:ring-2 focus-visible:ring-primary-hover"
                >
                  {status === 'loading' ? 'Sending…' : 'Submit'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
