'use client';

import { useCallback, useEffect, useState } from 'react';

export function usePWAUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    let registration: ServiceWorkerRegistration | null = null;
    navigator.serviceWorker.ready.then((reg) => {
      registration = reg;
      if (reg.waiting) { setWaitingWorker(reg.waiting); setUpdateAvailable(true); }
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        if (!w) return;
        w.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(w); setUpdateAvailable(true);
          }
        });
      });
    });
    const interval = setInterval(() => { registration?.update().catch(() => {}); }, 60_000);
    const onControllerChange = () => { window.location.reload(); };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => {
      clearInterval(interval);
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
  }, [waitingWorker]);

  return { updateAvailable, applyUpdate };
}
