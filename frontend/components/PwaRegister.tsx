'use client';

import { useEffect } from 'react';

/** Registers the service worker for PWA installability. */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
      // Non-fatal in dev
    });
  }, []);
  return null;
}
