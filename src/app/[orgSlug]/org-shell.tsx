'use client';

import { Header } from '@/components/header';
import { Sidebar } from '@/components/sidebar';
import { OutletGate } from '@/components/outlet-gate';
import { PlatformScopeGuard } from '@/components/platform-scope-guard';
import { DashboardScreensaver } from '@/components/dashboard-screensaver';
import { AuthProvider } from '@/providers/auth-provider';
import { BrandingProvider } from '@/providers/branding-provider';
import { SubscriptionEntitlementsProvider } from '@/providers/subscription-entitlements-provider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { Footer } from '@/components/footer';
import { SubscriptionBanner } from '@/components/subscription/subscription-banner';
import { VerifyEmailPrompt } from '@/components/auth/VerifyEmailPrompt';
import { PWAUpdateBanner } from '@/components/pwa-update-banner';
import { PWARegistration } from '@/components/pwa-registration';
import { MobileBottomNav } from '@/components/mobile-bottom-nav';
import { useAuthStore } from '@/store/auth';
import { useOutletStore } from '@/store/outlet';
import { useNotificationStream, type NotificationStreamMessage } from '@/hooks/use-notification-stream';
import { useQueryClient } from '@tanstack/react-query';
import { invalidateBulkStockQueries } from '@/hooks/useStock';
import { reportJobCompletion, labelForJobType } from '@/lib/bulk-job-alert-queue';
import { toast } from 'sonner';

// BUG FIX (live-reported): switching outlets — via the header's HQ-only OutletFilter, the
// select-outlet gate, PIN login, or the SSO callback's JWT-carried outlet — updates the
// X-Outlet-ID header apiClient sends on FUTURE requests (see store/outlet.ts), but nothing told
// already-mounted React Query hooks to refetch: no outlet-scoped hook's queryKey includes the
// outlet, so the catalog/stock/etc. kept silently serving the PREVIOUS outlet's cached rows —
// the page header/subtitle updated instantly (it reads the Zustand store directly) while the
// actual data didn't, making two different outlets look identical. Fixed centrally here (one
// watcher on the single source of truth, useOutletStore.outlet — every real flow updates this,
// including the HQ dropdown via applyOutlet/applyAll's setHomeOutlet) rather than adding an
// invalidate call to each of the several pages/components that can change the outlet, which
// would silently rot as new outlet-scoped pages are added. Mounted in BOTH OrgShell branches
// (including the bare auth-route layout) so a PIN login or the select-outlet gate — which
// render there, before the dashboard shell exists — also gets this.
function OutletQuerySync() {
    const outletId = useOutletStore((s) => s.outlet?.id ?? null);
    const queryClient = useQueryClient();
    useEffect(() => {
        void queryClient.invalidateQueries();
        // Only the outlet identity should trigger this — queryClient is a stable ref for the
        // lifetime of this shell.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [outletId]);
    return null;
}

// Real-time push (stock changes + background bulk-job completion) — mounted once for the whole
// tenant session so a POS sale (or any other stock mutation) shows up live on the Stock page
// instead of only on a manual refresh, and a background bulk job (item outlet-membership change,
// bulk stock adjustment — see MoveStockDialog/BulkAdjustStockDialog) reports its real result the
// moment it finishes instead of the user having to guess or manually refresh to find out.
function NotificationListener() {
    const tenantID = useAuthStore((s) => s.user?.tenant_id ?? '');
    const userID = useAuthStore((s) => s.user?.id ?? '');
    const outletId = useOutletStore((s) => s.outlet?.id ?? null);
    const orgSlug = (useParams()?.orgSlug as string) || '';
    const queryClient = useQueryClient();

    const onMessage = (msg: NotificationStreamMessage) => {
        if (msg.type !== 'bulk_job.completed') return;
        // Broadcast is tenant-wide (no per-user WebSocket targeting) — only toast for the user
        // who actually started this job; other sessions just get the silent query invalidation
        // below (their lists still refresh to reflect the change, just no toast noise for a job
        // they didn't run).
        invalidateBulkStockQueries(queryClient, orgSlug);
        if (msg.payload.created_by && userID && msg.payload.created_by !== userID) return;
        const label = labelForJobType(msg.payload.job_type);
        const { processed, failed, status } = msg.payload;
        // If this job was queued from THIS tab (see useSetItemOutletMembership/
        // useBulkAdjustStock), its toast is compiled with any other jobs still outstanding from
        // the same batch and fires once the last one finishes — see bulk-job-alert-queue.ts.
        // Untracked (a different tab/session, or queued before a reload) falls back to the
        // original immediate per-event toast below.
        if (reportJobCompletion(msg.payload.job_id, { status, processed, failed })) return;
        if (status === 'failed') {
            toast.error(`${label} failed`, { duration: 8000 });
            return;
        }
        if (failed > 0) {
            toast.warning(`${label} complete — ${processed} applied, ${failed} skipped`, { duration: 8000 });
        } else {
            toast.success(`${label} complete — ${processed} item${processed === 1 ? '' : 's'} updated`);
        }
    };

    useNotificationStream({ tenantID, outletID: outletId, onMessage });
    return null;
}

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
                        <OutletQuerySync />
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
                    <SubscriptionEntitlementsProvider>
                    <ManifestInjector />
                    <OutletQuerySync />
                    <NotificationListener />
                    <PlatformScopeGuard />
                    <OutletGate />
                    <DashboardScreensaver />
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
                            <VerifyEmailPrompt />
                            <main className="flex-1 min-h-0 overflow-y-auto bg-accent/5">
                                {/* Bottom padding on mobile clears the fixed bottom nav bar. */}
                                <div className="min-h-full flex flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
                                    <div className="flex-1">{children}</div>
                                    <Footer />
                                </div>
                            </main>
                        </div>
                        {/* App-style bottom navigation + quick-add, phones only. */}
                        <MobileBottomNav onOpenMenu={() => setSidebarOpen(true)} />
                    </div>
                    </SubscriptionEntitlementsProvider>
                </BrandingProvider>
            </AuthProvider>
        </QueryClientProvider>
    );
}
