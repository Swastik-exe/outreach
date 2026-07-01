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
      // Still open mock flow info — user can verify via script
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

  const tiers: { key: PlanKey; highlight?: boolean; description: string; bullets: string[] }[] = [
    {
      key: 'seasonPass',
      description: 'One-time pass for placement season — covers your entire sprint.',
      bullets: ['20 resume analyses / month', 'Full tracker + score engine', '6-month season window'],
    },
    {
      key: 'monthly',
      highlight: true,
      description: 'Most flexible — cancel anytime.',
      bullets: ['100 resume analyses / month', 'Priority AI analysis', 'All premium features'],
    },
    {
      key: 'annual',
      description: 'Best value for committed builders.',
      bullets: [
        '100 resume analyses / month',
        `${formatInr(pricing.annual.perMonthInr ?? Math.round(pricing.annual.amountInr / 12))}/mo billed annually`,
        'All premium features',
      ],
    },
  ];

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <header className="text-center">
        <h1 className="text-3xl font-bold font-space text-text">Choose your plan</h1>
        <p className="text-muted mt-2 max-w-lg mx-auto">
          Invest in your placement journey — every tier is designed to help you move forward calmly.
        </p>
      </header>

      {error && (
        <p className="text-center text-sm text-orange-400" role="alert">
          {error}
        </p>
      )}
      {sandboxNote && (
        <p className="text-center text-sm text-amber-400 bg-amber-400/10 rounded-lg p-3" role="status">
          {sandboxNote}
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map(({ key, highlight, description, bullets }) => {
          const tier = pricing[key];
          const isSeason = key === 'seasonPass';
          return (
            <article
              key={key}
              className={cn(
                'relative rounded-2xl border p-6 flex flex-col',
                highlight
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/40 scale-[1.02]'
                  : 'border-border bg-surface',
              )}
            >
              {highlight && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-medium bg-primary text-white">
                  Most Popular
                </span>
              )}
              <h2 className="text-lg font-semibold font-space text-text">{tier.label}</h2>
              <p className="text-sm text-muted mt-1 flex-1">{description}</p>

              <div className="mt-6">
                <p className="text-3xl font-bold font-mono text-text">
                  {charmPrice(tier.amountInr)}
                  {!isSeason && (
                    <span className="text-sm font-normal text-muted font-sans">
                      {key === 'annual' ? '/yr' : '/mo'}
                    </span>
                  )}
                </p>
                {key === 'annual' && tier.perMonthInr != null && (
                  <p className="text-xs text-muted mt-1">
                    ≈ {formatInr(tier.perMonthInr)}/month
                  </p>
                )}
                {isSeason && (
                  <p className="text-xs text-muted mt-1">One-time · {tier.months ?? 6} months</p>
                )}
              </div>

              <ul className="mt-4 space-y-2 text-sm text-muted">
                {bullets.map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="text-emerald-400" aria-hidden>✓</span>
                    {b}
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={loading || checkoutBusy != null}
                onClick={() => handleCheckout(key)}
                className={cn(
                  'mt-6 w-full min-h-[44px] rounded-lg text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                  highlight
                    ? 'bg-primary text-white hover:bg-primary-lt disabled:opacity-50'
                    : 'border border-border text-text hover:bg-surface2 disabled:opacity-50',
                )}
              >
                {checkoutBusy === key ? 'Starting…' : isSeason ? 'Get Season Pass' : 'Subscribe'}
              </button>
            </article>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted">
        Free tier includes 3 resume analyses per month.{' '}
        <Link href="/settings/billing" className="text-primary-lt hover:underline">
          View current usage
        </Link>
      </p>
    </div>
  );
}
