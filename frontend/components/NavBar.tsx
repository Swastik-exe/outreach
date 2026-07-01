'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth';
import { cn } from '@/lib/utils';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/tracker', label: 'Tracker' },
  { href: '/resume', label: 'Resume' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/settings', label: 'Settings' },
];

export function NavBar() {
  const pathname = usePathname();
  const { logout, isPlatformAdmin } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const links = isPlatformAdmin
    ? [...NAV_LINKS, { href: '/admin', label: 'Admin' }]
    : NAV_LINKS;

  return (
    <header
      className="border-b border-[#2A2D36] bg-[#0A0B0E]/80 backdrop-blur-sm sticky top-0 z-40"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div
        className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-2 sm:gap-4"
        style={{
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <Link
          href="/dashboard"
          className="text-base sm:text-lg font-bold tracking-tight text-white shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded min-h-[44px] flex items-center"
        >
          out<span className="text-indigo-400">reach</span>
        </Link>

        <nav
          className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto flex-1 justify-end scrollbar-none"
          aria-label="Main navigation"
        >
          {links.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap',
                'min-h-[44px] flex items-center',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
                (href === '/dashboard' ? pathname === href : pathname === href || pathname.startsWith(href + '/'))
                  ? 'bg-indigo-500/10 text-indigo-400'
                  : 'text-[#8B8FA8] hover:text-[#F4F5F7] hover:bg-[#1A1D24]',
              )}
            >
              {label}
            </Link>
          ))}

          <button
            type="button"
            onClick={handleLogout}
            className={cn(
              'px-2 sm:px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors shrink-0',
              'text-[#8B8FA8] hover:text-[#F4F5F7] hover:bg-[#1A1D24]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500',
              'min-h-[44px] min-w-[44px] flex items-center justify-center',
            )}
          >
            Log out
          </button>
        </nav>
      </div>
    </header>
  );
}
