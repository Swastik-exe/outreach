'use client';

import { useEffect } from 'react';
import { captureClientError } from '../lib/monitoring';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    captureClientError(error);
  }, [error]);

  return (
    <main className="min-h-dvh bg-bg text-text flex items-center justify-center px-6">
      <div className="text-center max-w-[380px]">
        <h1 className="font-space font-semibold text-[22px]">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted">
          An unexpected error happened on this screen. Your data is safe — try
          again, and if it keeps happening, reload the page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="inline-flex items-center justify-center mt-6 h-11 px-5 rounded-[10px] bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
