import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <main className="min-h-dvh bg-bg text-text flex items-center justify-center px-6">
      <div className="text-center max-w-[380px]">
        <p className="font-mono text-[13px] text-dim tabular-nums">404</p>
        <h1 className="mt-2 font-space font-semibold text-[22px]">
          This page doesn&apos;t exist
        </h1>
        <p className="mt-2 text-sm text-muted">
          The link may be old, or the address was mistyped. Your data is fine.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center mt-6 h-11 px-5 rounded-[10px] bg-primary hover:bg-primary-hover text-white text-sm font-semibold transition-colors"
        >
          Back to dashboard
        </Link>
      </div>
    </main>
  );
}
