'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

type TabId = 'home' | 'tracker' | 'resume' | 'score';

const ICONS: Record<TabId, string> = {
  home: 'M4 4.5h6.5V11H4Z M13.5 4.5H20V11h-6.5Z M4 13.5h6.5V20H4Z M13.5 13.5H20V20h-6.5Z',
  tracker:
    'M3.5 5.5l1.5 1.5 2.5-2.5 M3.5 11.5l1.5 1.5 2.5-2.5 M3.5 17.5l1.5 1.5 2.5-2.5 M11.5 6H21 M11.5 12H21 M11.5 18H21',
  resume:
    'M13.5 3H7a1.5 1.5 0 0 0-1.5 1.5v15A1.5 1.5 0 0 0 7 21h10a1.5 1.5 0 0 0 1.5-1.5V8L13.5 3Z M13.5 3v5h5 M9.5 12.5h5 M9.5 16h5',
  score:
    'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z M16.5 12a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z M12 12h.01',
};

const TABS: { id: TabId; label: string; href: string }[] = [
  { id: 'home', label: 'Home', href: '/dashboard' },
  { id: 'tracker', label: 'Tracker', href: '/tracker' },
  { id: 'resume', label: 'Resume', href: '/resume' },
  { id: 'score', label: 'Score', href: '/dashboard/breakdown' },
];

function activeTab(pathname: string): TabId {
  if (pathname.startsWith('/tracker')) return 'tracker';
  if (pathname.startsWith('/resume')) return 'resume';
  if (
    pathname.startsWith('/dashboard/breakdown') ||
    pathname.startsWith('/dashboard/history') ||
    pathname.startsWith('/dashboard/cohort')
  ) {
    return 'score';
  }
  return 'home';
}

export function TabBar() {
  const pathname = usePathname();
  const active = activeTab(pathname);

  return (
    <nav
      aria-label="Primary"
      className="shell:hidden fixed left-0 right-0 bottom-0 z-40 flex border-t border-border chrome-sticky"
      style={{
        /* Solid fill — backdrop-blur on fixed chrome tanks scroll FPS on mobile */
        background: '#0B1220',
        padding: '6px 8px calc(6px + env(safe-area-inset-bottom))',
      }}
    >
      {TABS.map(({ id, label, href }) => {
        const isOn = id === active;
        const color = isOn ? '#A78BFA' : '#A5B4C3';
        return (
          <Link
            key={id}
            href={href}
            aria-current={isOn ? 'page' : undefined}
            className={cn(
              'flex-1 flex flex-col items-center justify-center gap-[3px] min-h-12 no-underline rounded-[10px] relative overflow-hidden transition-colors duration-150',
              'active:bg-row-hover',
              isOn && 'bg-primary/10',
            )}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={color}
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={ICONS[id]} />
            </svg>
            <span
              className="text-[10.5px] font-semibold tracking-[0.02em]"
              style={{ color }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
