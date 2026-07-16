'use client';

import { usePathname } from 'next/navigation';
import { tokenStore } from '@/lib/api';
import { decodeJwtPayload } from '@/lib/jwt';

const TITLE_MAP: { test: (p: string) => boolean; title: string }[] = [
  { test: (p) => p === '/dashboard', title: 'Dashboard' },
  { test: (p) => p.startsWith('/dashboard/breakdown'), title: 'Breakdown' },
  { test: (p) => p.startsWith('/dashboard/history'), title: 'History' },
  { test: (p) => p.startsWith('/dashboard/cohort'), title: 'Cohort' },
  { test: (p) => p.startsWith('/tracker'), title: 'Tracker' },
  { test: (p) => p.startsWith('/resume'), title: 'Resume' },
  { test: (p) => p.startsWith('/settings/billing'), title: 'Billing' },
  { test: (p) => p.startsWith('/settings'), title: 'Settings' },
  { test: (p) => p.startsWith('/pricing'), title: 'Pricing' },
  { test: (p) => p.startsWith('/admin'), title: 'Admin' },
];

function initialsFromEmail(email: string | undefined): string {
  if (!email) return 'OU';
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || 'OU';
}

export function MobileHeader() {
  const pathname = usePathname();
  const title =
    TITLE_MAP.find((t) => t.test(pathname))?.title ?? 'Outreach';

  const payload = decodeJwtPayload(tokenStore.get() ?? '');
  const email = typeof payload?.email === 'string' ? payload.email : undefined;
  const initials = initialsFromEmail(email);

  return (
    <header
      className="shell:hidden sticky top-0 z-20 flex items-center gap-2.5 px-4 border-b border-border chrome-sticky"
      style={{
        paddingTop: 'calc(10px + env(safe-area-inset-top))',
        paddingBottom: '10px',
        /* Solid fill — sticky backdrop-blur causes scroll jank */
        background: '#050816',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/logo-purple.svg" alt="" width={22} height={22} />
      <span className="font-space font-semibold text-base text-text">{title}</span>
      <span
        aria-hidden="true"
        className="ml-auto w-[30px] h-[30px] rounded-full bg-primary text-text flex items-center justify-center text-[11px] font-semibold"
      >
        {initials}
      </span>
    </header>
  );
}
