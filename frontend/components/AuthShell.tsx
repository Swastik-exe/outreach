'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/** Shared auth chrome — matches Auth.dc.html (centered 400px card on #050816). */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main
      className="min-h-screen min-h-[100dvh] bg-bg text-text flex flex-col items-center justify-center"
      style={{
        padding:
          'calc(24px + env(safe-area-inset-top)) 16px calc(32px + env(safe-area-inset-bottom))',
        fontSize: 15,
        lineHeight: 1.55,
      }}
    >
      <Link
        href="/"
        className="flex items-center gap-2.5 no-underline mb-[26px]"
        aria-label="Outreach home"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/logo-purple.svg" alt="" width={30} height={30} />
        <span className="font-space font-semibold text-lg text-text">Outreach</span>
      </Link>

      <div
        className="w-full bg-surface border border-border"
        style={{
          width: 'min(400px, 100%)',
          borderRadius: 18,
          padding: 'clamp(22px, 5vw, 30px)',
        }}
      >
        {children}
      </div>

      <div className="mt-[18px] text-[12.5px] text-dim text-center max-w-[40ch]">
        Your data stays yours — we never sell it, and you control what you share.
      </div>
    </main>
  );
}

export const authInputClass =
  'w-full h-[46px] px-[13px] rounded-[10px] border border-border bg-card text-text text-sm placeholder:text-dim transition-colors duration-150 focus:outline-none focus:border-primary';

export const authLabelClass =
  'block text-[12.5px] font-semibold text-muted mb-1.5';

export const authPrimaryBtnClass =
  'w-full h-[46px] rounded-[10px] border-none bg-primary text-white text-[14.5px] font-semibold transition-colors duration-150 hover:bg-primary-hover active:bg-primary-active disabled:opacity-50 disabled:cursor-not-allowed';

export const authSecondaryBtnClass =
  'w-full h-[42px] rounded-[10px] border-none bg-transparent text-muted text-[13.5px] font-medium transition-colors duration-150 hover:text-text';

export function AuthTabs({ active }: { active: 'login' | 'register' }) {
  return (
    <div
      role="tablist"
      aria-label="Sign in or create account"
      className="flex bg-card border border-border rounded-[11px] p-1 gap-1"
    >
      <Link
        href="/login"
        role="tab"
        aria-selected={active === 'login'}
        className={
          active === 'login'
            ? 'flex-1 min-h-11 rounded-lg flex items-center justify-center no-underline text-[13.5px] font-semibold bg-surface text-text'
            : 'flex-1 min-h-11 rounded-lg flex items-center justify-center no-underline text-[13.5px] font-semibold bg-transparent text-muted hover:text-text active:bg-inner'
        }
      >
        Sign in
      </Link>
      <Link
        href="/register"
        role="tab"
        aria-selected={active === 'register'}
        className={
          active === 'register'
            ? 'flex-1 min-h-11 rounded-lg flex items-center justify-center no-underline text-[13.5px] font-semibold bg-surface text-text'
            : 'flex-1 min-h-11 rounded-lg flex items-center justify-center no-underline text-[13.5px] font-semibold bg-transparent text-muted hover:text-text active:bg-inner'
        }
      >
        Create account
      </Link>
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 my-[18px]">
      <span className="flex-1 h-px bg-border" />
      <span className="text-xs text-dim">or with any email</span>
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}
