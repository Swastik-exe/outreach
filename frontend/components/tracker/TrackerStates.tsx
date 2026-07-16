'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = 'Something went wrong loading your data.',
  onRetry,
}: ErrorStateProps) {
  return (
    <section
      aria-label="Sync problem"
      className="flex flex-wrap items-start gap-3.5 rounded-[14px] border border-border bg-card px-[18px] py-4"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-error/15">
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#FB7185"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 8v5 M12 16.5v.01 M12 2.8 22 20H2Z" />
        </svg>
      </span>
      <div className="min-w-[220px] flex-1">
        <div className="text-[14.5px] font-semibold text-text">
          Your list didn&apos;t sync
        </div>
        <div className="mt-0.5 text-[13.5px] text-muted">
          {message}. Changes you make now are stored and will sync when we reconnect.
        </div>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'h-10 shrink-0 rounded-[10px] border border-border bg-bg px-4',
            'text-[13.5px] font-semibold text-text transition-colors',
            'hover:border-hover-border hover:bg-card',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        >
          Retry now
        </button>
      )}
    </section>
  );
}

export function EmptyApplications() {
  return (
    <section
      aria-label="No applications"
      className="flex flex-col items-center rounded-2xl border border-border bg-card px-6 py-12 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary/15">
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#A78BFA"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3.5 5.5l1.5 1.5 2.5-2.5 M3.5 11.5l1.5 1.5 2.5-2.5 M3.5 17.5l1.5 1.5 2.5-2.5 M11.5 6H21 M11.5 12H21 M11.5 18H21" />
        </svg>
      </span>
      <h2 className="mt-4 font-space text-[17px] font-semibold text-text">
        Track your first application
      </h2>
      <p className="mt-1 mb-[18px] max-w-[44ch] text-sm text-muted text-pretty">
        Every application you track — and follow up on time — feeds your momentum subscore.
        It takes 20 seconds.
      </p>
      <div className="flex flex-wrap justify-center gap-2.5">
        <Link
          href="/tracker/add"
          className={cn(
            'inline-flex h-11 items-center justify-center rounded-[10px] px-[18px]',
            'text-sm font-semibold text-white bg-primary transition-colors',
            'hover:bg-primary-hover',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        >
          Add manually
        </Link>
        <Link
          href="/settings"
          className={cn(
            'inline-flex h-11 items-center justify-center rounded-[10px] border border-border bg-bg px-4',
            'text-[13.5px] font-semibold text-text transition-colors',
            'hover:border-hover-border',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        >
          Set up email forwarding
        </Link>
      </div>
    </section>
  );
}
