'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'outreach-pwa-install-dismissed';

function BenefitIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#2DD4BF"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="flex-none mt-0.5"
    >
      {children}
    </svg>
  );
}

/** Surfaces native "Add to Home Screen" when available; iOS shows manual hint. */
export function PwaInstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);
    if (standalone || localStorage.getItem(DISMISS_KEY)) return;

    const ua = window.navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(ua) && !(window as Window & { MSStream?: unknown }).MSStream;
    setIsIos(ios);
    if (ios) {
      setVisible(true);
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => window.removeEventListener('beforeinstallprompt', onBip);
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
    setTimeout(() => setVisible(false), 400);
  }, []);

  const install = useCallback(async () => {
    if (isIos) return;
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setDeferred(null);
    setTimeout(() => setVisible(false), 1200);
  }, [deferred, isIos]);

  if (!visible || isStandalone) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Install Outreach"
      className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-bg/70 backdrop-blur-sm pointer-events-none"
    >
      <div className="w-full max-w-[380px] pointer-events-auto relative">
        {/* Blurred preview card */}
        <div
          aria-hidden="true"
          className="bg-card border border-border rounded-[18px] p-5 opacity-45 blur-[1.5px]"
        >
          <div className="flex items-center gap-2">
            <Image src="/assets/logo-purple.svg" alt="" width={20} height={20} />
            <span className="font-space font-semibold text-sm">Dashboard</span>
          </div>
          <div className="flex gap-4 items-center mt-4">
            <div className="relative w-[88px] h-[88px] shrink-0">
              <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
                <circle cx="44" cy="44" r="37" fill="none" stroke="#22304A" strokeWidth="7" opacity="0.55" />
                <circle
                  cx="44"
                  cy="44"
                  r="37"
                  fill="none"
                  stroke="#7C3AED"
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray="142.3 232.5"
                  transform="rotate(-90 44 44)"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-xl text-primary-lt">
                612
              </div>
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <div className="h-2.5 rounded-md bg-inner w-4/5" />
              <div className="h-2.5 rounded-md bg-inner w-3/5" />
              <div className="h-2.5 rounded-md bg-inner w-[70%]" />
            </div>
          </div>
        </div>

        {/* Bottom sheet dialog */}
        <div className="relative -mt-8 bg-surface border border-hover-border rounded-[20px] p-6 shadow-[0_24px_64px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-3.5">
            <span className="shrink-0 w-14 h-14 rounded-[14px] bg-card border border-border flex items-center justify-center">
              <Image src="/assets/logo-purple.svg" alt="" width={32} height={32} />
            </span>
            <div className="flex-1 min-w-0">
              <span className="block font-space font-semibold text-[17px] text-text">
                Keep Outreach one tap away
              </span>
              <span className="block text-[12.5px] text-dim mt-0.5">
                outreach.app · 0 MB download · works offline
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 mt-[18px]">
            <div className="flex gap-2.5 items-start">
              <BenefitIcon>
                <path d="M13 2 4.5 13.5h6L11 22l8.5-11.5h-6L13 2Z" />
              </BenefitIcon>
              <span className="text-[13.5px] text-muted text-pretty">
                Opens straight to your score — no browser, no typing the URL at 11 pm
              </span>
            </div>
            <div className="flex gap-2.5 items-start">
              <BenefitIcon>
                <path d="M12 21a9 9 0 1 0-9-9 M12 7v5l3.5 2 M3 12h.01" />
              </BenefitIcon>
              <span className="text-[13.5px] text-muted text-pretty">
                {isIos
                  ? 'Tap Share, then "Add to Home Screen" for quick access and offline shell'
                  : 'Follow-up reminders arrive even when the tab is closed'}
              </span>
            </div>
            <div className="flex gap-2.5 items-start">
              <BenefitIcon>
                <path d="M2.5 8.5C5 5.5 8.3 4 12 4s7 1.5 9.5 4.5 M5.5 12c1.8-2 4-3 6.5-3s4.7 1 6.5 3 M9 15.5c.9-1 1.9-1.5 3-1.5s2.1.5 3 1.5 M12 19.5h.01" />
              </BenefitIcon>
              <span className="text-[13.5px] text-muted text-pretty">
                Tracker works offline — spotty wifi is not a dependency
              </span>
            </div>
          </div>

          {(!isIos && deferred) || isIos ? (
            <button
              type="button"
              onClick={isIos ? dismiss : install}
              className="w-full h-12 mt-5 rounded-[11px] border-none bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:bg-primary-active transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
            >
              {installed
                ? 'Added to home screen'
                : isIos
                  ? 'Got it'
                  : 'Add to home screen'}
            </button>
          ) : null}

          <button
            type="button"
            onClick={dismiss}
            className="w-full h-[42px] mt-2 rounded-[10px] border-none bg-transparent text-muted text-[13.5px] font-medium hover:text-text hover:bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-hover"
          >
            {dismissed ? 'Okay — we won\'t ask again' : 'Maybe later'}
          </button>

          <div className="mt-3 text-[11.5px] text-dim text-center">
            We ask once. Find it later in Settings if you change your mind.
          </div>
        </div>
      </div>
    </div>
  );
}
