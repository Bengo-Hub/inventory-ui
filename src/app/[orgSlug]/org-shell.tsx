'use client';

import { Header } from '@/components/header';
import { Sidebar } from '@/components/sidebar';
import { OutletGate } from '@/components/outlet-gate';
import { AuthProvider } from '@/providers/auth-provider';
import { BrandingProvider } from '@/providers/branding-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { Footer } from '@/components/footer';
import { SubscriptionBanner } from '@/components/subscription/subscription-banner';
import { PWAUpdateBanner } from '@/components/pwa-update-banner';
import { PWARegistration } from '@/components/pwa-registration';

/**
 * Client-side belt-and-suspenders for the tenant manifest link. The authoritative
 * link is emitted server-side via `generateMetadata` in this segment's layout.tsx
 * (so mobile install captures the correct tenant); this keeps it correct across
 * in-app (SPA) navigation between tenant scopes.
 */
function ManifestInjector() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string | undefined;
    useEffect(() => {
        if (!orgSlug) return;
        const href = `/${orgSlug}/manifest.webmanifest`;
        let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        if (!link) {
            link = document.createElement('link');
            link.rel = 'manifest';
            document.head.appendChild(link);
        }
        if (link.href !== new URL(href, window.location.href).href) {
            link.href = href;
        }
    }, [orgSlug]);
    return null;
}

export function OrgShell({ children }: { children: ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 60 * 1000,     // 5 min — most data is reference/moderate
                gcTime: 10 * 60 * 1000,        // 10 min garbage collection
                retry: 2,
                refetchOnWindowFocus: false,
            },
        },
    }));
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const pathname = usePathname();
    // Pre-dashboard auth screens (SSO callback, outlet-select gate) render with
    // their own bare layout — no sidebar/header — matching the POS pin-login and
    // TruLoad station-select gates.
    const isAuthRoute = !!pathname && pathname.includes('/auth/');

    if (isAuthRoute) {
        return (
            <QueryClientProvider client={queryClient}>
                <AuthProvider>
                    <BrandingProvider>
                        <ManifestInjector />
                        <div className="min-h-screen bg-background">{children}</div>
                    </BrandingProvider>
                </AuthProvider>
            </QueryClientProvider>
        );
    }

    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <BrandingProvider>
                    <ManifestInjector />
                    <OutletGate />
                    <PWAUpdateBanner />
                    <PWARegistration />
                    {/*
                      * Shell is fixed to the viewport so the document never scrolls.
                      * Only <main> (overflow-y-auto + min-h-0) scrolls its content.
                      * min-h-0 is required on <main> — without it flex children have
                      * min-height:auto and overflow-y-auto never creates a scroll context.
                      */}
                    <div className="fixed inset-0 flex overflow-hidden bg-background">
                        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
                        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                            <Header onMenuClick={() => setSidebarOpen(true)} />
                            <SubscriptionBanner />
                            <main className="flex-1 min-h-0 overflow-y-auto bg-accent/5">
                                <div className="min-h-full flex flex-col">
                                    <div className="flex-1">{children}</div>
                                    <Footer />
                                </div>
                            </main>
                        </div>
                    </div>
                </BrandingProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}
