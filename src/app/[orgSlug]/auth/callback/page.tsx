'use client';

import { useBiometric } from '@/hooks/use-biometric';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { Fingerprint, Loader2 } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

function AuthCallbackContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const params = useParams();
    const urlSlug = params?.orgSlug as string;
    const code = searchParams?.get('code');
    const error = searchParams?.get('error');
    const { handleSSOCallback, hydrateFromWebAuthn, status, error: authError } = useAuthStore();
    const hasStarted = useRef(false);

    // Authoritative tenant for this sign-in: the slug we persisted when starting SSO. SSO may
    // return to a registered default callback under a DIFFERENT slug (this was the bug that
    // landed users on `codevertex`); the persisted slug keeps us on the intended tenant.
    const [orgSlug, setOrgSlug] = useState(urlSlug);
    const [slugReady, setSlugReady] = useState(false);
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const intended = sessionStorage.getItem('sso_org_slug');
            if (intended && intended !== urlSlug) setOrgSlug(intended);
        }
        setSlugReady(true);
    }, [urlSlug]);

    const [lastEmail, setLastEmail] = useState<string | null>(null);
    const [biometricAvailable, setBiometricAvailable] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const email = localStorage.getItem('sso_last_email');
            const registered = localStorage.getItem('pwa_biometric_registered') === 'true';
            setLastEmail(email);
            setBiometricAvailable(!!email && registered);
        }
    }, []);

    const { isSupported, isLoading: biometricLoading, state: biometricState, error: biometricError, authenticate } = useBiometric({
        onAuthSuccess: async (tokens) => {
            await hydrateFromWebAuthn(tokens, orgSlug);
        },
    });

    useEffect(() => {
        if (slugReady && code && orgSlug && !hasStarted.current) {
            hasStarted.current = true;
            // redirect_uri for the token exchange MUST match the URL SSO actually returned to
            // (the current route's slug), even when we fetch the profile for the intended tenant.
            const callbackUrl = `${window.location.origin}/${urlSlug}/auth/callback`;
            handleSSOCallback(orgSlug, code, callbackUrl);
        }
    }, [slugReady, code, orgSlug, urlSlug, handleSSOCallback]);

    useEffect(() => {
        if (status === 'authenticated') {
            if (typeof window !== 'undefined') sessionStorage.removeItem('sso_org_slug');
            const returnTo = sessionStorage.getItem('sso_return_to');
            sessionStorage.removeItem('sso_return_to');
            const storedOutlet = typeof window !== 'undefined'
                ? localStorage.getItem('inventory-selected-outlet-id') : null;
            if (storedOutlet) {
                router.replace(returnTo || `/${orgSlug}`);
                return;
            }

            // Auto-preselect outlet from JWT claims for non-HQ single-outlet users.
            const authState = useAuthStore.getState();
            const authUser = authState.user;
            const jwtOutletId = (authUser as any)?.outlet_id || (authUser as any)?.outletId;
            const isHqUser = (authUser as any)?.is_hq_user || (authUser as any)?.isHqUser;

            if (jwtOutletId && !isHqUser) {
                if (typeof window !== 'undefined') {
                    localStorage.setItem('inventory-selected-outlet-id', jwtOutletId);
                }
                apiClient.setOutletID(jwtOutletId);
                router.replace(returnTo || `/${orgSlug}`);
                return;
            }

            const next = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';
            router.replace(`/${orgSlug}/auth/select-outlet${next}`);
        }
    }, [status, orgSlug, router]);

    if (error || authError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center p-8 border border-destructive/20 rounded-xl bg-destructive/5 max-w-md">
                    <h1 className="text-xl font-bold text-destructive mb-2">Authentication Failed</h1>
                    <p className="text-muted-foreground">{error || authError}</p>
                    <button
                        onClick={() => router.replace(`/${orgSlug}/auth/login`)}
                        className="mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-lg"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    const showBiometric = !code && biometricAvailable && isSupported;

    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="text-center space-y-6">
                {showBiometric && (
                    <div className="flex flex-col items-center gap-4 p-6 border border-border rounded-xl bg-card max-w-xs mx-auto">
                        <p className="text-sm text-muted-foreground">
                            Sign in faster with biometrics
                        </p>
                        {lastEmail && (
                            <p className="text-xs text-muted-foreground font-medium truncate max-w-full px-2">
                                {lastEmail}
                            </p>
                        )}
                        <button
                            onClick={() => lastEmail && authenticate(lastEmail, orgSlug)}
                            disabled={biometricLoading}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-60 transition-opacity"
                        >
                            {biometricLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Fingerprint className="h-4 w-4" />
                            )}
                            {biometricLoading ? 'Verifying...' : 'Use Fingerprint / Face ID'}
                        </button>
                        {biometricError && biometricState === 'error' && (
                            <p className="text-xs text-destructive">{biometricError}</p>
                        )}
                        <div className="relative w-full">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-border" />
                            </div>
                            <div className="relative flex justify-center">
                                <span className="bg-card px-2 text-xs text-muted-foreground">or</span>
                            </div>
                        </div>
                        <button
                            onClick={() => router.replace(`/${orgSlug}`)}
                            className="text-xs text-muted-foreground underline underline-offset-2"
                        >
                            Sign in with SSO instead
                        </button>
                    </div>
                )}

                {code && (
                    <>
                        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <h1 className="text-xl font-medium">Completing Sign-in...</h1>
                        <p className="text-muted-foreground">Syncing your profile and permissions.</p>
                    </>
                )}

                {/* No auth code and no biometric prompt → SSO returned without completing.
                    Offer a clean retry instead of spinning forever. */}
                {!code && !showBiometric && (
                    <div className="max-w-sm mx-auto">
                        <h1 className="text-xl font-medium mb-2">Sign-in didn&apos;t complete</h1>
                        <p className="text-muted-foreground mb-6">Your session may have expired or been interrupted. Please sign in again.</p>
                        <button
                            onClick={() => router.replace(`/${orgSlug}/auth/login`)}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
                        >
                            Sign in
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function AuthCallbackPage() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Loading...</div>}>
            <AuthCallbackContent />
        </Suspense>
    );
}
