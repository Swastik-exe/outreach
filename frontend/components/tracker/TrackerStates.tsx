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
    <div className="rounded-xl border border-border bg-surface p-6 text-center">
      <p className="text-muted text-sm">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'mt-4 inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg',
            'text-sm font-medium bg-primary/10 text-primary-lt hover:bg-primary/20',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyApplications() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-surface/50 p-8 sm:p-12 text-center">
      <p className="text-lg font-medium text-text font-space">Your tracker is ready</p>
      <p className="mt-2 text-sm text-muted max-w-md mx-auto">
        Add your first application to start building a calm picture of your job search —
        every step counts, even the early ones.
      </p>
      <Link
        href="/tracker/add"
        className={cn(
          'mt-6 inline-flex items-center justify-center min-h-[44px] px-5 py-2.5 rounded-lg',
          'text-sm font-medium bg-primary text-white hover:bg-primary-lt transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
        )}
      >
        Add your first application
      </Link>
    </div>
  );
}
