'use client';

import { Button } from '@/components/ui/base';
import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export function PWARegistration() {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [showInstall, setShowInstall] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        const handler = (e: Event) => {
            e.preventDefault();
            setDeferredPrompt(e);
            const wasDismissed = sessionStorage.getItem('pwa_dismissed');
            if (!wasDismissed) {
                setShowInstall(true);
            }
        };

        window.addEventListener('beforeinstallprompt', handler);

        window.addEventListener('appinstalled', () => {
            setDeferredPrompt(null);
            setShowInstall(false);
            toast.success('BengoBox Inventory installed successfully!');
        });

        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    useEffect(() => {
        if (deferredPrompt && !dismissed) {
            const timer = setTimeout(() => {
                setShowInstall(true);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [deferredPrompt, dismissed]);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            setDeferredPrompt(null);
            setShowInstall(false);
        }
    };

    const handleDismiss = () => {
        setShowInstall(false);
        setDismissed(true);
        sessionStorage.setItem('pwa_dismissed', '1');
    };

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
                    <button onClick={handleDismiss} className="h-8 w-8 flex items-center justify-center rounded-md hover:bg-accent transition">
                        <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <Button size="sm" onClick={handleInstall} className="shadow-lg shadow-primary/20">Install</Button>
                </div>
            </div>
        </div>
    );
}
