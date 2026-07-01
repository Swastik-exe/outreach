'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'outreach-pwa-install-dismissed';

/** Surfaces native "Add to Home Screen" when available; iOS shows manual hint. */
export function PwaInstallHint() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

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
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setVisible(false);
  }, [deferred]);

  if (!visible || isStandalone) return null;

  return (
    <div
      role="region"
      aria-label="Install Outreach app"
      className="fixed bottom-0 inset-x-0 z-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <div className="mx-auto max-w-lg pointer-events-auto bg-[#111318] border border-[#2A2D36] rounded-2xl shadow-xl p-4 flex gap-3 items-start">
        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
          <Download className="w-5 h-5 text-indigo-400" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#F4F5F7]">Install Outreach</p>
          {isIos ? (
            <p className="text-xs text-[#8B8FA8] mt-1">
              Tap Share, then &quot;Add to Home Screen&quot; for quick access and offline shell.
            </p>
          ) : (
            <p className="text-xs text-[#8B8FA8] mt-1">
              Add to your home screen for app-like access — works offline for the shell.
            </p>
          )}
          <div className="flex gap-2 mt-3">
            {!isIos && deferred && (
              <button
                type="button"
                onClick={install}
                className="min-h-[44px] px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
              >
                Install
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              className="min-h-[44px] px-4 py-2 text-sm text-[#8B8FA8] hover:text-[#F4F5F7] transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss install hint"
          className="flex-shrink-0 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#8B8FA8] hover:text-[#F4F5F7]"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
