'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth';
import { FullPageLoader } from '@/components/VortexLoader';
import { ScoreRing } from '@/components/ScoreRing';
import { BandBadge } from '@/components/BandBadge';

const FEATURES = [
  {
    icon: '🗂️',
    title: 'Application Tracker',
    body: 'A calm, single place for every application — status, timelines, and follow-up nudges so nothing slips through.',
  },
  {
    icon: '📄',
    title: 'Resume Analyzer',
    body: 'Upload your resume and get readiness signals — keyword gaps, impact, formatting — with concrete next fixes.',
  },
  {
    icon: '📈',
    title: 'Career Health Score',
    body: 'One number that pulls together your resume, applications, skills, and profile — so you always know your next highest-impact move.',
  },
] as const;

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  // Logged-in users get bounced to /dashboard above — avoid flashing the
  // landing page while that redirect is in flight.
  if (isLoading || isAuthenticated) {
    return <FullPageLoader />;
  }

  return (
    <main className="min-h-screen min-h-[100dvh] bg-bg text-text overflow-x-hidden">
      {/* Top bar */}
      <header
        className="border-b border-border"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-lg font-bold tracking-tight text-white">
            out<span className="text-primary-lt">reach</span>
          </span>
          <Link
            href="/login"
            className="min-h-[44px] px-3 flex items-center text-sm font-medium text-muted hover:text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="text-center lg:text-left">
            <h1 className="font-space text-3xl sm:text-4xl lg:text-5xl font-bold text-text leading-tight">
              Know exactly where your placement prep stands
            </h1>
            <p className="mt-4 text-muted text-base sm:text-lg max-w-lg mx-auto lg:mx-0">
              Outreach tracks your applications, analyses your resume, and turns it all into one
              clear career readiness score — so you always know your next move, not just your last one.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link
                href="/register"
                className="inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-lt transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Get started — it&apos;s free
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 rounded-lg text-sm font-medium border border-border text-text hover:bg-surface2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Sign in
              </Link>
            </div>

            <p className="mt-6 text-xs text-muted max-w-md mx-auto lg:mx-0">
              Your score is a <strong className="text-text">readiness signal, not a guarantee</strong> —
              a compass for what to work on next, not a verdict on you.
            </p>
          </div>

          {/* Score ring preview */}
          <div className="flex flex-col items-center gap-4">
            <div className="bg-surface border border-border rounded-2xl p-8 flex flex-col items-center gap-4">
              <ScoreRing score={740} band="Strong" size={200} />
              <BandBadge band="Strong" bandRange="650–849" size="md" />
              <p className="text-xs text-muted text-center max-w-[220px]">
                Your Career Health Score — updated automatically as you apply, improve your resume,
                and build your profile.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <h2 className="font-space text-2xl sm:text-3xl font-bold text-text text-center">
          Everything your placement season needs, in one place
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-surface border border-border rounded-2xl p-6 text-center sm:text-left"
            >
              <div className="text-3xl mb-3" aria-hidden="true">{f.icon}</div>
              <h3 className="font-space font-semibold text-text">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20 sm:pb-28 text-center">
        <div
          className="rounded-2xl border border-primary/30 bg-primary/5 p-8 sm:p-12"
          style={{
            paddingBottom: 'max(2rem, calc(env(safe-area-inset-bottom) + 1rem))',
          }}
        >
          <h2 className="font-space text-xl sm:text-2xl font-bold text-text">
            Start building your readiness score today
          </h2>
          <p className="mt-2 text-sm text-muted max-w-md mx-auto">
            Free to start. No credit card required.
          </p>
          <Link
            href="/register"
            className="mt-6 inline-flex items-center justify-center min-h-[44px] px-6 py-2.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary-lt transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Create your free account
          </Link>
        </div>
      </section>
    </main>
  );
}
