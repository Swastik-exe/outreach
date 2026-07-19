'use client';

import { useEffect } from 'react';
import { captureClientError } from '../lib/monitoring';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientError(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#050816', color: '#E8EAF0', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 24 }}>
          <div style={{ textAlign: 'center', maxWidth: 380 }}>
            <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
            <p style={{ marginTop: 8, fontSize: 14, color: '#9AA3B5' }}>
              An unexpected error happened. Your data is safe — try again, or reload the page.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{
                marginTop: 24,
                height: 44,
                padding: '0 20px',
                borderRadius: 10,
                border: 'none',
                background: '#7C6BF0',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
