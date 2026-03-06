'use client';

import { useMe } from '@/hooks/useMe';
import { useAuthStore } from '@/store/auth';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

export function AuthProvider({ children }: { children: ReactNode }) {
    const { status, initialize } = useAuthStore();
    const pathname = usePathname();
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;
    const session = useAuthStore((s) => s.session);
    const { isError, error, isLoading: meLoading } = useMe(!!session);

    const isAuthCallback = pathname?.includes('/auth');
    const isUnauthorizedPage = pathname?.endsWith('/unauthorized');

    useEffect(() => {
        initialize();
    }, [initialize]);

    useEffect(() => {
        if (status === 'idle' && !pathname?.includes('/auth') && orgSlug) {
            useAuthStore.getState().redirectToSSO(orgSlug, window.location.href);
        }
    }, [status, pathname, orgSlug]);

    useEffect(() => {
        if (!session || isUnauthorizedPage || meLoading) return;
        const statusCode = (error as { response?: { status?: number } })?.response?.status;
        if (isError && statusCode === 403 && orgSlug) {
            router.replace(`/${orgSlug}/unauthorized`);
        }
    }, [session, isError, error, isUnauthorizedPage, meLoading, orgSlug, router]);

    const loading = status === 'loading' || (!!session && meLoading);
    if (loading && !isAuthCallback) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="animate-pulse text-muted-foreground">Initializing session...</div>
            </div>
        );
    }

    return <>{children}</>;
}
