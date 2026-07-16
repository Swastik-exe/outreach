'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';

interface UpgradePromptProps {
  /** e.g. "resume analyses" */
  feature: string;
  /** Optional locked preview value shown greyed/blurred */
  lockedPreview?: string;
  className?: string;
}

/**
 * Shown when quota blocks an action (429). Shows the locked value, not just text.
 */
export function UpgradePrompt({ feature, lockedPreview, className }: UpgradePromptProps) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-primary/30 bg-primary/[0.07] p-5 sm:p-6',
        className,
      )}
      role="region"
      aria-label="Upgrade to unlock"
    >
      <p className="font-medium text-primary-lt">You&apos;ve reached your free limit</p>
      <p className="text-sm text-muted mt-1">
        Upgrade to unlock more {feature} and keep building momentum.
      </p>

      {lockedPreview && (
        <div className="mt-4 relative rounded-xl border border-inner bg-surface overflow-hidden">
          <div
            className="p-4 blur-[7px] select-none opacity-55"
            aria-hidden="true"
          >
            <p className="text-sm font-mono text-text">{lockedPreview}</p>
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-bg/55">
            <span className="text-xs font-medium text-muted px-3 py-1 rounded-full bg-card border border-border">
              Locked — upgrade to view
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/pricing"
          className={cn(
            'inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-[10px]',
            'text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        >
          View plans
        </Link>
        <Link
          href="/settings/billing"
          className={cn(
            'inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-[10px]',
            'text-sm font-semibold border border-border bg-surface text-text hover:border-hover-border',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          )}
        >
          Billing & usage
        </Link>
      </div>
    </div>
  );
}
