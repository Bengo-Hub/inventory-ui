'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { useBranding } from '@/providers/branding-provider';
import { requestAppPermissions } from '@/hooks/use-app-permissions';
import { Button } from '@/components/ui/base';

const DISMISS_KEY = 'inv_pwa_install_dismissed_until';
const RE_PROMPT_MS = 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isDismissedRecently() {
  if (typeof window === 'undefined') return false;
  return Date.now() < parseInt(localStorage.getItem(DISMISS_KEY) ?? '0', 10);
}

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS() {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window as unknown as { MSStream?: unknown }).MSStream;
}

export function PWARegistration() {
  const { tenant } = useBranding();
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

  const appName = tenant?.orgName ? `${tenant.orgName} Inventory` : 'BengoBox Inventory';
  const logoUrl = tenant?.logoUrl;

  useEffect(() => {
    if (isStandalone() || isDismissedRecently()) return;

    if (isIOS()) {
      setIos(true);
      setTimeout(() => setVisible(true), 3000);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      if (!isDismissedRecently()) setTimeout(() => setVisible(true), 3000);
    };

    const onInstalled = () => setVisible(false);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    const timer = setInterval(() => {
      if (!isDismissedRecently() && promptRef.current) setVisible(true);
    }, RE_PROMPT_MS);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      clearInterval(timer);
    };
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, String(Date.now() + RE_PROMPT_MS));
    setVisible(false);
  }, []);

  const install = useCallback(async () => {
    if (!promptRef.current) return;
    promptRef.current.prompt();
    const { outcome } = await promptRef.current.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
      await requestAppPermissions();
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50 w-[min(22rem,calc(100vw-2rem))]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="bg-card border border-border rounded-2xl shadow-2xl shadow-black/10 overflow-hidden">
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className="h-11 w-11 rounded-xl overflow-hidden border border-border shrink-0 flex items-center justify-center bg-primary/10">
            {logoUrl ? (
              <img src={logoUrl} alt={appName} className="h-full w-full object-contain p-1" />
            ) : ios ? (
              <Share className="h-5 w-5 text-primary" />
            ) : (
              <Download className="h-5 w-5 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">Install {appName}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
              {ios ? 'Add to Home Screen for offline access.' : 'Track stock offline — syncs when reconnected.'}
            </p>
          </div>
          <button
            onClick={dismiss}
            className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-accent shrink-0 transition-colors -mt-1 -mr-1"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {ios ? (
          <ol className="px-4 pb-4 space-y-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-2.5">
              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
              Tap <Share className="h-3.5 w-3.5 inline mx-0.5 text-primary shrink-0" /> <strong className="text-foreground">Share</strong> in Safari
            </li>
            <li className="flex items-center gap-2.5">
              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
              Tap <strong className="text-foreground">"Add to Home Screen"</strong>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
              Tap <strong className="text-foreground">"Add"</strong>
            </li>
          </ol>
        ) : (
          <div className="flex items-center gap-2 px-4 pb-4">
            <button
              className="flex-1 text-sm text-muted-foreground py-2 px-3 rounded-xl hover:bg-accent transition-colors"
              onClick={dismiss}
            >
              Later
            </button>
            <Button size="sm" className="flex-1 shadow-md shadow-primary/20" onClick={install}>
              Install
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
