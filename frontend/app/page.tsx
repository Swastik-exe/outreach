'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth';
import { FullPageLoader } from '@/components/VortexLoader';
import { LandingScoreMock } from '@/components/landing/LandingScoreMock';

const FEATURES = [
  {
    title: 'Application Tracker',
    body: 'Every application, every stage, one calm list. Follow-up reminders before things go quiet — forward a confirmation email and it files itself.',
    foot: 'Statuses are journey markers, never red flags.',
    iconBg: 'rgba(124,58,237,.14)',
    iconColor: '#A78BFA',
    path: 'M3.5 5.5l1.5 1.5 2.5-2.5 M3.5 11.5l1.5 1.5 2.5-2.5 M3.5 17.5l1.5 1.5 2.5-2.5 M11.5 6H21 M11.5 12H21 M11.5 18H21',
  },
  {
    title: 'Resume Analyzer',
    body: 'Upload a PDF, get a readiness score plus the exact bullets to rewrite — with before/after examples and estimated point gains.',
    foot: 'Readiness signals — not a company\u2019s real ATS.',
    iconBg: 'rgba(45,212,191,.12)',
    iconColor: '#2DD4BF',
    path: 'M13.5 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8L13.5 3Z M13.5 3v5h5 M9.5 12.5h5 M9.5 16h5',
  },
  {
    title: 'Career Health Score',
    body: 'One number, 0–1000, recomputed daily from five explainable subscores. Every change comes with a reason and a next step.',
    foot: 'Explainable, honest, yours.',
    iconBg: 'rgba(245,158,11,.12)',
    iconColor: '#F59E0B',
    path: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z M12 12h.01',
  },
] as const;

const STEPS = [
  {
    num: '1',
    title: 'Sign up with any email',
    body: 'No resume required to begin. Verify once — your dashboard is ready.',
  },
  {
    num: '2',
    title: 'See your starting score',
    body: 'A calm 0–1000 readiness number. Most people begin between 200 and 320 — a starting point, not a verdict.',
  },
  {
    num: '3',
    title: 'Do the next action',
    body: 'The dashboard always shows the single highest-impact step, with an estimated point gain.',
  },
] as const;

function FeatureIcon({ path, color }: { path: string; color: string }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace('/dashboard');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || isAuthenticated) {
    return <FullPageLoader />;
  }

  return (
    <div
      className="min-h-screen min-h-[100dvh] bg-bg text-text text-[15px] leading-[1.55] overflow-x-hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Sticky header */}
      <header
        className="sticky top-0 z-30 bg-bg border-b border-border"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="max-w-marketing mx-auto px-[clamp(16px,4vw,36px)] h-[60px] flex items-center gap-5">
          <Link href="#top" className="flex items-center gap-2.5 no-underline shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo-purple.svg" alt="" width={26} height={26} />
            <span className="font-space font-semibold text-[16.5px] text-text">Outreach</span>
          </Link>

          <nav aria-label="Site" className="ml-auto flex items-center gap-1">
            <Link
              href="#features"
              className="hidden min-[720px]:inline-flex px-3 py-2 rounded-lg text-[13.5px] font-medium text-muted no-underline whitespace-nowrap hover:text-text hover:bg-card transition-colors"
            >
              How it works
            </Link>
            <Link
              href="/pricing"
              className="hidden min-[720px]:inline-flex px-3 py-2 rounded-lg text-[13.5px] font-medium text-muted no-underline whitespace-nowrap hover:text-text hover:bg-card transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="hidden min-[720px]:inline-flex px-3 py-2 rounded-lg text-[13.5px] font-medium text-muted no-underline whitespace-nowrap hover:text-text hover:bg-card transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="inline-flex items-center min-h-11 px-[15px] rounded-[9px] bg-primary text-white text-[13.5px] font-semibold no-underline ml-1.5 whitespace-nowrap hover:bg-primary-hover active:bg-primary-active transition-colors"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="max-w-marketing mx-auto px-[clamp(16px,4vw,36px)] py-[clamp(48px,9vw,96px)] pb-[clamp(40px,7vw,72px)] flex gap-[clamp(28px,5vw,64px)] items-center flex-wrap">
          <div className="flex-[1_1_420px] min-w-[min(100%,320px)]">
            <div className="inline-block px-[13px] py-1.5 rounded-full bg-surface border border-border text-[12.5px] font-medium text-muted leading-normal">
              For students, new grads, and career switchers
            </div>

            <h1 className="mt-[18px] font-space font-bold text-[clamp(32px,5.4vw,52px)] leading-[1.08] tracking-[-0.015em] text-balance">
              The job search, without the panic.
            </h1>

            <p className="mt-[18px] text-[clamp(15.5px,1.6vw,17.5px)] text-muted max-w-[54ch] text-pretty">
              Track every application, fix your resume with specific evidence-based changes, and watch
              one honest number — your Career Health Score — climb as you act.
            </p>

            <div className="flex gap-3 mt-[26px] flex-wrap items-center">
              <Link
                href="/register"
                className="inline-flex items-center h-12 px-[22px] rounded-[11px] bg-primary text-white text-[15px] font-semibold no-underline whitespace-nowrap hover:bg-primary-hover active:bg-primary-active transition-colors"
              >
                Get started free
              </Link>
              <Link
                href="#features"
                className="inline-flex items-center h-12 px-[18px] rounded-[11px] border border-border text-text text-[14.5px] font-semibold no-underline bg-surface whitespace-nowrap hover:border-hover-border transition-colors"
              >
                See how scoring works
              </Link>
            </div>

            <p className="mt-3.5 text-[13px] text-dim">
              A readiness signal, not a guarantee — we&apos;re honest about that.
            </p>
          </div>

          <div className="flex-[1_1_340px] min-w-[min(100%,300px)] flex justify-center">
            <LandingScoreMock />
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-t border-border bg-surface">
          <div className="max-w-marketing mx-auto px-[clamp(16px,4vw,36px)] py-[clamp(44px,7vw,72px)]">
            <h2 className="font-space font-semibold text-[clamp(22px,3vw,28px)] tracking-[-0.01em]">
              Three tools. One honest number.
            </h2>
            <p className="mt-2 text-[15px] text-muted max-w-[62ch]">
              Everything you do — applying, following up, fixing your resume — feeds the same score, so
              you always know the single most valuable next step.
            </p>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-4 mt-[30px]">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="bg-card border border-border rounded-2xl p-6 flex flex-col gap-3"
                >
                  <span
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: f.iconBg }}
                  >
                    <FeatureIcon path={f.path} color={f.iconColor} />
                  </span>
                  <h3 className="font-space font-semibold text-[17px]">{f.title}</h3>
                  <p className="text-sm text-muted text-pretty">{f.body}</p>
                  <div className="mt-auto text-[12.5px] text-dim">{f.foot}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Steps + CTA band */}
        <section className="border-t border-border">
          <div className="max-w-marketing mx-auto px-[clamp(16px,4vw,36px)] py-[clamp(44px,7vw,72px)]">
            <h2 className="font-space font-semibold text-[clamp(22px,3vw,28px)] tracking-[-0.01em]">
              From first login to job-ready
            </h2>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4 mt-7">
              {STEPS.map((s) => (
                <div key={s.num} className="flex gap-3.5 items-start">
                  <span className="shrink-0 w-[30px] h-[30px] rounded-[9px] bg-card border border-border text-primary-lt flex items-center justify-center font-mono text-[13.5px] font-semibold">
                    {s.num}
                  </span>
                  <span>
                    <span className="block text-[15px] font-semibold text-text">{s.title}</span>
                    <span className="block text-[13.5px] text-muted mt-0.5 text-pretty">{s.body}</span>
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-10 bg-card border border-border rounded-2xl p-[clamp(24px,4vw,36px)] flex gap-5 items-center flex-wrap">
              <div className="flex-1 min-w-[min(100%,280px)]">
                <h2 className="font-space font-semibold text-xl">
                  Any email. Then your starting score.
                </h2>
                <p className="mt-1.5 text-sm text-muted max-w-[56ch] text-pretty">
                  Sign up free — no resume required to begin. A low first score isn&apos;t a
                  verdict; it&apos;s a starting point with the fastest way up attached.
                </p>
              </div>
              <Link
                href="/register"
                className="inline-flex items-center h-12 px-[22px] rounded-[11px] bg-primary text-white text-[15px] font-semibold no-underline whitespace-nowrap hover:bg-primary-hover active:bg-primary-active transition-colors"
              >
                Get started free
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-surface">
        <div className="max-w-marketing mx-auto px-[clamp(16px,4vw,36px)] py-6 flex gap-4 items-center flex-wrap">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/assets/logo-white.svg"
              alt=""
              width={18}
              height={18}
              className="opacity-75"
            />
            <span className="text-[13px] text-dim">
              Outreach · made for job seekers, priced for students
            </span>
          </div>

          <nav aria-label="Footer" className="ml-auto flex gap-0.5 flex-wrap">
            {[
              { href: '/pricing', label: 'Pricing' },
              { href: '/login', label: 'Sign in' },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="px-2.5 py-2 rounded-lg text-[12.5px] text-muted no-underline hover:text-text transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  );
}
