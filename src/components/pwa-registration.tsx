'use client';

import { Button } from '@/components/ui/base';
import { Download, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

const DISMISS_KEY = 'pwa-install-dismissed-inventory-ui';
const DISMISS_DURATION_MS = 30 * 60 * 1000;

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true)
  );
}

function wasDismissedRecently(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const ts = parseInt(raw, 10);
  return !Number.isNaN(ts) && Date.now() - ts < DISMISS_DURATION_MS;
}

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWARegistration() {
    const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstall, setShowInstall] = useState(false);
    const promptRef = useRef<BeforeInstallPromptEvent | null>(null);

    useEffect(() => {
        if (isStandalone()) return;

        const handler = (e: Event) => {
            e.preventDefault();
            const ev = e as BeforeInstallPromptEvent;
            promptRef.current = ev;
            setDeferredPrompt(ev);
            if (!wasDismissedRecently()) setTimeout(() => setShowInstall(true), 2000);
        };

        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', () => {
            setDeferredPrompt(null);
            promptRef.current = null;
            setShowInstall(false);
            toast.success('BengoBox Inventory installed successfully!');
        });

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const handleInstall = useCallback(async () => {
        const prompt = promptRef.current ?? deferredPrompt;
        if (!prompt) return;
        await prompt.prompt();
        const { outcome } = await prompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            promptRef.current = null;
            setShowInstall(false);
        }
    }, [deferredPrompt]);

    const handleDismiss = useCallback(() => {
        setShowInstall(false);
        try {
            localStorage.setItem(DISMISS_KEY, Date.now().toString());
        } catch {}
    }, []);

    if (!showInstall) return null;

    return (
        <div className="fixed bottom-6 left-6 right-6 md:left-auto md:w-96 z-50 animate-in fade-in slide-in-from-bottom-5">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-2xl flex items-center gap-4">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <Download className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">Install BengoBox Inventory</p>
                    <p className="text-xs text-muted-foreground truncate">Get instant access from your home screen.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={handleDismiss} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent transition" aria-label="Dismiss">
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <Button size="sm" onClick={handleInstall} className="shadow-lg shadow-primary/20">Install</Button>
                </div>
            </div>
        </div>
    );
}
