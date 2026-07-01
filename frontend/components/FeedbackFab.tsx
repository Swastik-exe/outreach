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
          'bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm',
          'min-h-[44px] px-4 py-2',
          'bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0B0E]',
          'motion-safe:transition-colors',
        )}
        aria-label="Report bug or request feature"
      >
        <MessageSquarePlus className="w-5 h-5 shrink-0" aria-hidden />
        <span className="hidden sm:inline">Feedback</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4 bg-black/60"
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          onClick={(e) => e.target === e.currentTarget && close()}
        >
          <div className="w-full max-w-md rounded-xl bg-[#111318] border border-[#2A2D36] p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 id="feedback-title" className="text-lg font-semibold text-[#F4F5F7]">
                Report bug / Request feature
              </h2>
              <button
                type="button"
                onClick={close}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-[#8B8FA8] hover:text-white hover:bg-[#1A1D24] focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {status === 'success' ? (
              <p className="text-emerald-400 py-4 text-center" role="status">
                Thanks — we got your feedback!
              </p>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <p className="text-xs text-[#8B8FA8]">
                  Screen: <span className="font-mono text-[#F4F5F7]">{screen}</span>
                </p>

                <div className="flex gap-2" role="group" aria-label="Feedback type">
                  {(['bug', 'feature'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        'flex-1 min-h-[44px] rounded-lg text-sm font-medium capitalize',
                        'focus-visible:ring-2 focus-visible:ring-indigo-500',
                        type === t
                          ? 'bg-indigo-600 text-white'
                          : 'bg-[#1A1D24] text-[#8B8FA8] hover:text-white',
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
                  className="w-full rounded-lg bg-[#1A1D24] border border-[#2A2D36] px-3 py-2.5 text-sm text-[#F4F5F7] placeholder-[#4B4F63] focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y min-h-[100px]"
                />

                {error && (
                  <p className="text-sm text-red-400" role="alert">{error}</p>
                )}

                <button
                  type="submit"
                  disabled={status === 'loading' || !message.trim()}
                  className="w-full min-h-[44px] rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium focus-visible:ring-2 focus-visible:ring-indigo-400"
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
