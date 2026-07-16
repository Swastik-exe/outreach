'use client';

import { useCallback, useEffect, useState } from 'react';

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

    // Defer prompt so first paint / navigation stay smooth
    const showTimer = window.setTimeout(() => {
      if (ios) {
        setVisible(true);
        return;
      }
    }, 4500);

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      window.setTimeout(() => setVisible(true), 4500);
    };
    window.addEventListener('beforeinstallprompt', onBip);
    return () => {
      window.clearTimeout(showTimer);
      window.removeEventListener('beforeinstallprompt', onBip);
    };
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (isIos) return;
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setDeferred(null);
    window.setTimeout(() => setVisible(false), 800);
  }, [deferred, isIos]);

  if (!visible || isStandalone) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Install Outreach"
      className="fixed inset-0 z-50 flex items-end justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
      style={{ background: 'rgba(5,8,22,0.72)' }}
    >
      <div
        className="w-full max-w-[380px] pointer-events-auto bg-surface border border-hover-border rounded-[20px] p-6"
        style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.55)' }}
      >
        <div className="flex items-center gap-3.5">
          <span className="shrink-0 w-14 h-14 rounded-[14px] bg-card border border-border flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/logo-purple.svg" alt="" width={32} height={32} />
          </span>
          <div className="flex-1 min-w-0">
            <span className="block font-space font-semibold text-[17px] text-text">
              Keep Outreach one tap away
            </span>
            <span className="block text-[12.5px] text-dim mt-0.5">
              outreach.app · works offline
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2.5 mt-[18px]">
          <div className="flex gap-2.5 items-start">
            <BenefitIcon>
              <path d="M13 2 4.5 13.5h6L11 22l8.5-11.5h-6L13 2Z" />
            </BenefitIcon>
            <span className="text-[13.5px] text-muted">
              Opens straight to your score — no browser chrome
            </span>
          </div>
          <div className="flex gap-2.5 items-start">
            <BenefitIcon>
              <path d="M12 21a9 9 0 1 0-9-9 M12 7v5l3.5 2 M3 12h.01" />
            </BenefitIcon>
            <span className="text-[13.5px] text-muted">
              {isIos
                ? 'Tap Share, then “Add to Home Screen”'
                : 'Reminders even when the tab is closed'}
            </span>
          </div>
        </div>

        {(!isIos && deferred) || isIos ? (
          <button
            type="button"
            onClick={isIos ? dismiss : install}
            className="w-full h-12 mt-5 rounded-[11px] border-none bg-primary text-white text-sm font-semibold hover:bg-primary-hover active:bg-primary-active transition-colors duration-150"
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
          className="w-full h-[42px] mt-2 rounded-[10px] border-none bg-transparent text-muted text-[13.5px] font-medium hover:text-text transition-colors duration-150"
        >
          Maybe later
        </button>

        <div className="mt-3 text-[11.5px] text-dim text-center">
          We ask once. Find it later in Settings if you change your mind.
        </div>
      </div>
    </div>
  );
}
