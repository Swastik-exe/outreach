'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { DEFAULT_PRICING, charmPrice, formatInr } from '@/lib/billing';
import { openRazorpayCheckout } from '@/lib/razorpay';
import type { CheckoutResponse, PricingResponse } from '@/lib/types';
import { cn } from '@/lib/utils';

type PlanKey = 'seasonPass' | 'monthly' | 'annual';

const FAIR_PLAY = [
  {
    q: 'Will Free ever get worse?',
    a: 'No. What\'s free today stays free. We add paid features; we don\'t take free ones away.',
  },
  {
    q: 'What happens when I cancel?',
    a: 'You keep everything you made — history, analyses, tracker. You just stop getting the paid extras. No exports held for ransom.',
  },
  {
    q: 'Is my data sold or shown to recruiters?',
    a: 'Never sold. Nothing is visible to anyone unless you share a link yourself.',
  },
  {
    q: 'Why should I trust the score?',
    a: 'Every point is explained in your breakdown, and we\'re explicit about what it can\'t measure. Readiness, not a guarantee.',
  },
];

function CheckIcon({ dim }: { dim?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke={dim ? '#64748B' : '#34D399'}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="shrink-0 mt-0.5"
    >
      <path d="M4.5 12.5l5 5L19.5 7" />
    </svg>
  );
}

export default function PricingPage() {
  const router = useRouter();
  const [pricing, setPricing] = useState<PricingResponse>(DEFAULT_PRICING as PricingResponse);
  const [loading, setLoading] = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState<PlanKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sandboxNote, setSandboxNote] = useState<string | null>(null);

  const loadPricing = useCallback(async () => {
    const res = await api.get<PricingResponse>('/subscription/pricing');
    if (res.success && res.data) setPricing(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadPricing();
  }, [loadPricing]);

  async function handleCheckout(plan: PlanKey) {
    setCheckoutBusy(plan);
    setError(null);
    setSandboxNote(null);

    const res = await api.post<CheckoutResponse>('/subscription/checkout', { plan });
    setCheckoutBusy(null);

    if (!res.success || !res.data) {
      setError(res.error ?? 'Could not start checkout.');
      return;
    }

    const checkout = res.data;

    if (checkout.sandbox) {
      setSandboxNote(
        'Sandbox mode: Razorpay keys not configured. Use the dev webhook simulator to activate after checkout, or configure RAZORPAY_KEY_ID in .env.',
      );
      router.push('/settings/billing');
      return;
    }

    try {
      await openRazorpayCheckout({
        key: checkout.razorpayKeyId,
        amountInr: checkout.amountInr,
        currency: checkout.currency,
        orderId: checkout.orderId,
        subscriptionId: checkout.subscriptionId,
        email: checkout.prefillEmail,
        onSuccess: () => router.push('/settings/billing'),
        onDismiss: () => setError('Checkout closed. Your plan activates after payment succeeds.'),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed.');
    }
  }

  const paidTiers: {
    key: PlanKey;
    highlight?: boolean;
    tag: string;
    sub: string;
    subC: string;
    bullets: { t: string; dim?: boolean }[];
    cta: string;
    foot: string;
    btnStyle: 'primary' | 'outline';
  }[] = [
    {
      key: 'monthly',
      highlight: true,
      tag: 'For the serious sprint',
      sub: '≈ one lunch a month',
      subC: 'text-primary-lt',
      bullets: [
        { t: 'Everything in Free' },
        { t: 'Unlimited resume analyses' },
        { t: 'Email-forwarding auto-import' },
        { t: 'Full 90-day history + cohort view' },
        { t: 'Priority score recomputes' },
      ],
      cta: 'Go Plus',
      foot: 'Cancel in two taps, keep your data',
      btnStyle: 'primary',
    },
    {
      key: 'annual',
      tag: 'For the final push',
      sub: 'Best value for committed builders',
      subC: 'text-dim',
      bullets: [
        { t: 'Everything in Plus' },
        { t: 'Per-job-description resume matching', dim: true },
        { t: 'Mock interview question bank', dim: true },
        { t: 'Weekly written score review', dim: true },
        { t: 'Early access to new tools', dim: true },
      ],
      cta: 'Go Pro',
      foot: 'Honest tier: skip it unless interviewing weekly',
      btnStyle: 'outline',
    },
    {
      key: 'seasonPass',
      tag: 'One full search season',
      sub: 'One payment, no auto-renew',
      subC: 'text-dim',
      bullets: [
        { t: 'Everything in Plus for one season' },
        { t: '20 resume analyses / month' },
        { t: 'Full tracker + score engine' },
        { t: `${pricing.seasonPass.months ?? 6}-month season window` },
      ],
      cta: 'Get Season Pass',
      foot: 'No card on file after purchase',
      btnStyle: 'outline',
    },
  ];

  const seasonTier = pricing.seasonPass;

  return (
    <div className="w-full max-w-marketing mx-auto flex flex-col gap-10 -mt-2">
      <header className="text-center max-w-[620px] mx-auto">
        <h1 className="font-space font-bold text-[clamp(26px,4.5vw,38px)] tracking-tight text-balance text-text">
          Priced for a student budget. Honestly.
        </h1>
        <p className="mt-3 text-[15px] text-muted text-pretty">
          Free covers a full serious search. Paid tiers add analysis depth and automation — no feature is held hostage, and cancelling takes two taps.
        </p>
        <p className="mt-2.5 text-[12.5px] text-dim">
          Launch pricing — we&apos;re still tuning it with real users. If it changes, existing plans keep their price.
        </p>
        <p className="mt-1.5 text-[12.5px] text-dim">
          Prices in INR (Indian Rupees). Checkout currently runs through Razorpay.
        </p>
      </header>

      {error && (
        <p className="text-center text-sm text-error" role="alert">
          {error}
        </p>
      )}
      {sandboxNote && (
        <p className="text-center text-sm text-amber bg-amber/10 border border-amber/30 rounded-xl p-3" role="status">
          {sandboxNote}
        </p>
      )}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-4 items-stretch">
        {/* Free tier */}
        <section
          aria-label="Free"
          className="relative flex flex-col bg-card border-[1.5px] border-border rounded-[18px] px-6 pt-[26px] pb-6"
        >
          <div className="font-space font-semibold text-[17px]">Free</div>
          <div className="text-[12.5px] text-dim mt-0.5">A full serious search</div>
          <div className="flex items-baseline gap-1.5 mt-4">
            <span className="font-mono font-bold text-[34px] tracking-tight">₹0</span>
            <span className="text-[13px] text-dim">forever</span>
          </div>
          <div className="text-[12.5px] text-dim mt-0.5 min-h-[18px]">No card. No trial clock.</div>
          <div className="h-px bg-border my-[18px]" />
          <div className="flex flex-col gap-2.5">
            {[
              'Unlimited application tracking',
              'Career Health Score, daily',
              '2 resume analyses / month',
              'Follow-up reminders',
              'Score history, 30 days',
            ].map((t) => (
              <div key={t} className="flex gap-2.5 items-start">
                <CheckIcon />
                <span className="text-[13.5px] text-muted text-pretty">{t}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto pt-[22px]">
            <Link
              href="/dashboard"
              className="flex items-center justify-center h-[46px] rounded-[11px] bg-surface border-[1.5px] border-hover-border text-text text-sm font-semibold hover:border-primary/40 transition-colors"
            >
              Start free
            </Link>
            <div className="text-[11.5px] text-dim text-center mt-2">Yours as long as you want it</div>
          </div>
        </section>

        {/* Paid tiers */}
        {paidTiers.map(({ key, highlight, tag, sub, subC, bullets, cta, foot, btnStyle }) => {
          const tier = pricing[key];
          const isSeason = key === 'seasonPass';
          const isAnnual = key === 'annual';
          return (
            <section
              key={key}
              aria-label={tier.label}
              className={cn(
                'relative flex flex-col rounded-[18px] px-6 pt-[26px] pb-6 border-[1.5px]',
                highlight
                  ? 'bg-[linear-gradient(0deg,rgba(124,58,237,0.07),rgba(124,58,237,0.07)),#111827] border-primary-hover/55'
                  : 'bg-card border-border',
              )}
            >
              {highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center px-3.5 py-1 rounded-full bg-primary text-white text-[11.5px] font-bold tracking-wide whitespace-nowrap">
                  MOST POPULAR
                </span>
              )}
              <div className="font-space font-semibold text-[17px]">
                {highlight ? 'Plus' : isAnnual ? 'Pro' : tier.label}
              </div>
              <div className="text-[12.5px] text-dim mt-0.5">{tag}</div>
              <div className="flex items-baseline gap-1.5 mt-4">
                <span className="font-mono font-bold text-[34px] tracking-tight">
                  {charmPrice(tier.amountInr)}
                </span>
                <span className="text-[13px] text-dim">
                  {isSeason ? 'once' : isAnnual ? '/yr' : '/ month'}
                </span>
              </div>
              <div className={cn('text-[12.5px] mt-0.5 min-h-[18px]', subC)}>
                {sub}
                {isAnnual && tier.perMonthInr != null && (
                  <> · ≈ {formatInr(tier.perMonthInr)}/mo billed annually</>
                )}
                {isSeason && (
                  <> · valid {tier.months ?? 6} months</>
                )}
              </div>
              <div className="h-px bg-border my-[18px]" />
              <div className="flex flex-col gap-2.5">
                {bullets.map(({ t, dim }) => (
                  <div key={t} className="flex gap-2.5 items-start">
                    <CheckIcon dim={dim} />
                    <span className={cn('text-[13.5px] text-pretty', dim ? 'text-dim' : 'text-muted')}>
                      {t}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-auto pt-[22px]">
                <button
                  type="button"
                  disabled={loading || checkoutBusy != null}
                  onClick={() => handleCheckout(key)}
                  className={cn(
                    'w-full h-[46px] rounded-[11px] text-sm font-semibold transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    btnStyle === 'primary'
                      ? 'bg-primary text-white hover:bg-primary-hover border-[1.5px] border-primary'
                      : 'bg-surface border-[1.5px] border-hover-border text-text hover:border-primary/40',
                  )}
                >
                  {checkoutBusy === key ? 'Starting…' : cta}
                </button>
                <div className="text-[11.5px] text-dim text-center mt-2">{foot}</div>
              </div>
            </section>
          );
        })}
      </div>

      {/* Season pass banner */}
      <section
        aria-label="Season pass"
        className="bg-[linear-gradient(0deg,rgba(245,158,11,0.06),rgba(245,158,11,0.06)),#111827] border border-amber/35 rounded-2xl px-[22px] py-5 flex gap-4 items-center flex-wrap"
      >
        <span className="shrink-0 w-10 h-10 rounded-xl bg-amber/14 flex items-center justify-center">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 2.5 14.9 8.6 21.5 9.5 16.7 14.1 17.9 20.7 12 17.5 6.1 20.7 7.3 14.1 2.5 9.5 9.1 8.6Z" />
          </svg>
        </span>
        <div className="flex-1 min-w-[260px]">
          <div className="font-space font-semibold text-[16.5px]">
            Season Pass — {charmPrice(seasonTier.amountInr)} once, valid {seasonTier.months ?? 10} months
          </div>
          <p className="mt-1 text-[13.5px] text-muted max-w-[70ch] text-pretty">
            Everything in Plus for one full search, start to offer. One payment, no auto-renew, no card on file after purchase.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || checkoutBusy != null}
          onClick={() => handleCheckout('seasonPass')}
          className="inline-flex items-center h-[46px] px-5 rounded-[11px] bg-amber text-[#1A1000] text-sm font-bold hover:bg-[#FBBF24] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber"
        >
          {checkoutBusy === 'seasonPass' ? 'Starting…' : 'Get the Season Pass'}
        </button>
      </section>

      {/* Fair-play promises */}
      <div className="max-w-[640px] mx-auto flex flex-col gap-2">
        <h2 className="font-space font-semibold text-lg text-center mb-1">Fair-play promises</h2>
        {FAIR_PLAY.map(({ q, a }) => (
          <div key={q} className="bg-card border border-border rounded-xl px-[18px] py-3.5">
            <div className="text-sm font-semibold text-text">{q}</div>
            <div className="text-[13.5px] text-muted mt-1 text-pretty">{a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
