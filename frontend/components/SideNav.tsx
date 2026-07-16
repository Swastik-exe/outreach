'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth';
import { tokenStore } from '@/lib/api';
import { decodeJwtPayload } from '@/lib/jwt';
import { planLabel } from '@/lib/billing';
import { cn } from '@/lib/utils';

type NavId =
  | 'dashboard'
  | 'tracker'
  | 'resume'
  | 'breakdown'
  | 'history'
  | 'cohort'
  | 'settings'
  | 'billing'
  | 'admin';

const ICONS: Record<NavId, string> = {
  dashboard:
    'M4 4.5h6.5V11H4Z M13.5 4.5H20V11h-6.5Z M4 13.5h6.5V20H4Z M13.5 13.5H20V20h-6.5Z',
  tracker:
    'M3.5 5.5l1.5 1.5 2.5-2.5 M3.5 11.5l1.5 1.5 2.5-2.5 M3.5 17.5l1.5 1.5 2.5-2.5 M11.5 6H21 M11.5 12H21 M11.5 18H21',
  resume:
    'M13.5 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8L13.5 3Z M13.5 3v5h5 M9.5 12.5h5 M9.5 16h5',
  breakdown:
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z M12 12h.01',
  history: 'M4 4v15.5h16.5 M7.5 15l3.5-4 3 2.5L18.5 8',
  cohort:
    'M11.5 7.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z M2.5 20c.5-3.5 2.9-5.5 5.5-5.5s5 2 5.5 5.5 M15.5 4.3a3.5 3.5 0 0 1 0 6.4 M17.5 14.8c2 .7 3.5 2.4 4 5.2',
  settings: 'M4 7.5h9.5 M17.5 7.5H20 M15.5 5v5 M4 16.5h4.5 M12.5 16.5H20 M10.5 14v5',
  billing:
    'M3.5 6.5A1.5 1.5 0 0 1 5 5h14a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5Z M3.5 10h17 M7 14.5h4',
  admin:
    'M12 3l7.5 4v5.5c0 4.5-3 8.5-7.5 9.5-4.5-1-7.5-5-7.5-9.5V7L12 3Z',
};

const MAIN: { id: NavId; label: string; href: string }[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard' },
  { id: 'tracker', label: 'Tracker', href: '/tracker' },
  { id: 'resume', label: 'Resume', href: '/resume' },
];

const SCORE: { id: NavId; label: string; href: string }[] = [
  { id: 'breakdown', label: 'Breakdown', href: '/dashboard/breakdown' },
  { id: 'history', label: 'History', href: '/dashboard/history' },
  { id: 'cohort', label: 'Cohort', href: '/dashboard/cohort' },
];

const FOOT: { id: NavId; label: string; href: string }[] = [
  { id: 'settings', label: 'Settings', href: '/settings' },
  { id: 'billing', label: 'Billing', href: '/settings/billing' },
];

function isActive(pathname: string, href: string, id: NavId): boolean {
  if (id === 'dashboard') return pathname === '/dashboard';
  if (id === 'settings') return pathname === '/settings';
  if (id === 'billing') return pathname.startsWith('/settings/billing');
  return pathname === href || pathname.startsWith(href + '/');
}

function NavLink({
  id,
  label,
  href,
  active,
}: {
  id: NavId;
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative flex items-center gap-[11px] h-10 px-2.5 my-px rounded-[9px] text-sm font-medium no-underline overflow-hidden transition-colors duration-150 active:bg-inner',
        active
          ? 'bg-card text-text'
          : 'bg-transparent text-muted hover:text-text hover:bg-card',
      )}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? '#A78BFA' : '#64748B'}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d={ICONS[id]} />
      </svg>
      <span>{label}</span>
      {active && (
        <span
          className="ml-auto w-[5px] h-[5px] rounded-full bg-primary"
          aria-hidden="true"
        />
      )}
    </Link>
  );
}

function initialsFromEmail(email: string | undefined): string {
  if (!email) return 'OU';
  const local = email.split('@')[0] ?? '';
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || 'OU';
}

function displayNameFromEmail(email: string | undefined): string {
  if (!email) return 'You';
  const local = email.split('@')[0] ?? 'You';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ') || 'You';
}

export function SideNav() {
  const pathname = usePathname();
  const { logout, isPlatformAdmin } = useAuth();
  const router = useRouter();

  const payload = decodeJwtPayload(tokenStore.get() ?? '');
  const email = typeof payload?.email === 'string' ? payload.email : undefined;
  const planRaw = typeof payload?.plan === 'string' ? payload.plan : 'free';
  const plan = planLabel(planRaw.toLowerCase());
  const initials = initialsFromEmail(email);
  const name = displayNameFromEmail(email);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  return (
    <nav
      aria-label="Main navigation"
      className="w-[232px] h-full min-h-screen bg-surface border-r border-border flex flex-col box-border"
      style={{ padding: '18px 12px 14px' }}
    >
      <Link
        href="/dashboard"
        aria-label="Outreach home"
        className="flex items-center gap-2.5 px-2.5 pb-5 pt-1 no-underline rounded-lg"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-purple.svg" alt="" width={26} height={26} />
        <span className="font-space font-semibold text-[16.5px] text-text tracking-[0.01em]">
          Outreach
        </span>
      </Link>

      {MAIN.map((item) => (
        <NavLink
          key={item.id}
          {...item}
          active={isActive(pathname, item.href, item.id)}
        />
      ))}

      <div className="text-[11px] font-semibold tracking-[0.09em] uppercase text-dim px-2.5 pt-[18px] pb-[7px]">
        Score
      </div>

      {SCORE.map((item) => (
        <NavLink
          key={item.id}
          {...item}
          active={isActive(pathname, item.href, item.id)}
        />
      ))}

      <div className="flex-1" />

      {FOOT.map((item) => (
        <NavLink
          key={item.id}
          {...item}
          active={isActive(pathname, item.href, item.id)}
        />
      ))}

      {isPlatformAdmin && (
        <NavLink
          id="admin"
          label="Admin"
          href="/admin"
          active={isActive(pathname, '/admin', 'admin')}
        />
      )}

      <button
        type="button"
        onClick={handleLogout}
        className="flex items-center gap-[11px] h-10 px-2.5 my-px rounded-[9px] text-sm font-medium text-muted hover:text-text hover:bg-card transition-colors duration-150 w-full text-left"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#64748B"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 4.5H6.5A1.5 1.5 0 0 0 5 6v12a1.5 1.5 0 0 0 1.5 1.5H10 M14.5 16.5 19 12l-4.5-4.5 M19 12H10" />
        </svg>
        <span>Log out</span>
      </button>

      <div className="flex items-center gap-2.5 mt-3 pt-2.5 px-2.5 border-t border-border">
        <span
          aria-hidden="true"
          className="w-8 h-8 rounded-full bg-primary text-text flex items-center justify-center text-xs font-semibold tracking-[0.02em] shrink-0"
        >
          {initials}
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px] font-semibold text-text whitespace-nowrap overflow-hidden text-ellipsis">
            {name}
          </span>
          <span className="block text-[11.5px] text-dim">{plan} plan</span>
        </span>
      </div>
    </nav>
  );
}
