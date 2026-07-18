import { apiClient } from '@/lib/api/client';
import { buildAuthorizeUrl, buildLogoutUrl, exchangeCodeForTokens, fetchInventoryProfile, fetchProfile, revokeServerSession } from '@/lib/auth/api';
import { useOutletStore } from '@/store/outlet';
import {
    consumeVerifier,
    generateCodeChallenge,
    generateCodeVerifier,
    generateState,
    storeState,
    storeVerifier
} from '@/lib/auth/pkce';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface UserProfile {
    id: string;
    email: string;
    fullName: string;
    roles: string[];
    permissions: string[];
    tenant_id: string;
    tenant_slug: string;
    isPlatformOwner?: boolean;
    isSuperUser?: boolean;
    // auth-api's computed graduated email-verification state (forwarded by /auth/me).
    email_verification?: import('@bengo-hub/shared-ui-lib/auth').EmailVerificationState;
}

interface Session {
    accessToken: string;
    refreshToken: string;
    expiresAt: string;
}

interface AuthState {
    status: 'idle' | 'loading' | 'authenticated' | 'error' | 'syncing' | 'subscription_required';
    user: UserProfile | null;
    session: Session | null;
    error: string | null;
    lastAuthenticatedAt: number | null;

    /** Subscription info fetched lazily after login (undefined = not started, null = loading). */
    subscriptionInfo: Record<string, unknown> | null | undefined;
    setSubscriptionInfo: (info: Record<string, unknown> | null) => void;

    initialize: () => Promise<void>;
    redirectToSSO: (orgSlug: string, returnTo?: string, opts?: { silent?: boolean }) => Promise<void>;
    handleSSOCallback: (orgSlug: string, code: string, callbackUrl: string) => Promise<void>;
    hydrateFromWebAuthn: (tokens: { accessToken: string; refreshToken: string; expiresIn: number }, tenantSlug?: string) => Promise<void>;
    logout: () => Promise<void>;
    fetchUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            status: 'idle',
            subscriptionInfo: undefined,
            setSubscriptionInfo: (info: Record<string, unknown> | null) => set({ subscriptionInfo: info }),
            user: null,
            session: null,
            error: null,
            lastAuthenticatedAt: null,

            initialize: async () => {
                const { session, user } = get();
                if (!session) {
                    set({ status: 'idle' });
                    return;
                }

                apiClient.setAccessToken(session.accessToken);
                if (user) {
                    apiClient.setTenantInfo(user.tenant_id, user.tenant_slug);
                }

                // Hydrate from storage if user profile exists and token hasn't expired.
                if (user && session.expiresAt) {
                    const expiresAt = new Date(session.expiresAt).getTime();
                    if (Date.now() < expiresAt - 60_000) {
                        set({ status: 'authenticated', lastAuthenticatedAt: Date.now() });
                        return;
                    }
                }

                set({ status: 'loading' });

                // Fetch fresh profile from inventory-api (syncs local RBAC roles and permissions).
                const storedSlug = user?.tenant_slug
                    ?? (typeof window !== 'undefined' ? localStorage.getItem('tenantSlug') : null)
                    ?? '';
                try {
                    const freshUser = await fetchInventoryProfile(storedSlug);
                    apiClient.setTenantInfo(freshUser.tenant_id, freshUser.tenant_slug);
                    set({ user: freshUser, status: 'authenticated', lastAuthenticatedAt: Date.now() });
                } catch (error) {
                    console.error('Failed to initialize auth:', error);
                    set({ status: 'idle', session: null, user: null });
                }
            },

            redirectToSSO: async (orgSlug: string, returnTo?: string, opts?: { silent?: boolean }) => {
                set({ status: 'loading', error: null });
                try {
                    const verifier = generateCodeVerifier();
                    const challenge = await generateCodeChallenge(verifier);
                    const state = generateState();

                    storeVerifier(verifier);
                    storeState(state);

                    // Persist the tenant we're signing into so the callback uses the RIGHT slug even
                    // if SSO returns to a registered default callback (e.g. /codevertex/auth/callback)
                    // instead of our redirect_uri — the previous cause of landing on the wrong tenant.
                    if (typeof window !== 'undefined') {
                        sessionStorage.setItem('sso_org_slug', orgSlug);
                        localStorage.setItem('tenantSlug', orgSlug);
                        sessionStorage.setItem('sso_return_to', returnTo || `/${orgSlug}`);
                        // Silent probe (prompt=none): mark it so the callback knows a
                        // login_required answer means "fall back to PIN login quietly",
                        // and so the provider never retries the probe this session.
                        if (opts?.silent) sessionStorage.setItem('sso_silent_probe', '1');
                    }

                    const callbackUrl = `${window.location.origin}/${orgSlug}/auth/callback`;
                    const authorizeUrl = buildAuthorizeUrl({
                        codeChallenge: challenge,
                        state,
                        redirectUri: callbackUrl,
                        tenant: orgSlug,
                        prompt: opts?.silent ? 'none' : undefined,
                    });

                    window.location.href = authorizeUrl;
                } catch (error) {
                    set({ status: 'error', error: 'Failed to start sign-in' });
                    throw error;
                }
            },

            handleSSOCallback: async (orgSlug: string, code: string, callbackUrl: string) => {
                set({ status: 'syncing', error: null });
                const verifier = consumeVerifier();

                if (!verifier) {
                    set({ status: 'error', error: 'Session expired' });
                    return;
                }

                try {
                    const tokens = await exchangeCodeForTokens({
                        code,
                        codeVerifier: verifier,
                        redirectUri: callbackUrl,
                    });

                    const session: Session = {
                        accessToken: tokens.access_token,
                        refreshToken: tokens.refresh_token || '',
                        expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
                    };

                    apiClient.setAccessToken(session.accessToken);
                    set({ session });

                    // Call inventory-api /auth/me to sync local RBAC roles and permissions.
                    // Retries on transient errors but stops immediately on 401/403.
                    let attempts = 0;
                    while (attempts < 5) {
                        try {
                            const user = await fetchInventoryProfile(orgSlug);
                            apiClient.setTenantInfo(user.tenant_id, user.tenant_slug);
                            if (typeof window !== 'undefined' && user?.email) {
                                localStorage.setItem('sso_last_email', user.email);
                            }
                            set({ user, status: 'authenticated', lastAuthenticatedAt: Date.now() });
                            return;
                        } catch (err: unknown) {
                            const status = (err as { response?: { status?: number } })?.response?.status;
                            if (status === 401 || status === 403) break;
                            attempts++;
                            await new Promise(r => setTimeout(r, 1200));
                        }
                    }

                    set({ status: 'error', error: 'Sign-in failed — could not verify identity' });
                } catch (error) {
                    set({ status: 'error', error: 'Sign-in failed' });
                }
            },

            hydrateFromWebAuthn: async (tokens: { accessToken: string; refreshToken: string; expiresIn: number }, tenantSlug?: string) => {
                set({ status: 'syncing', error: null });
                try {
                    const session: Session = {
                        accessToken: tokens.accessToken,
                        refreshToken: tokens.refreshToken || '',
                        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
                    };

                    apiClient.setAccessToken(session.accessToken);
                    set({ session });

                    const slug = tenantSlug ?? (typeof window !== 'undefined' ? localStorage.getItem('tenantSlug') : null) ?? '';
                    let attempts = 0;
                    while (attempts < 5) {
                        try {
                            const user = await fetchInventoryProfile(slug);
                            apiClient.setTenantInfo(user.tenant_id, user.tenant_slug);
                            if (typeof window !== 'undefined' && user?.email) {
                                localStorage.setItem('sso_last_email', user.email);
                            }
                            set({ user, status: 'authenticated', lastAuthenticatedAt: Date.now() });
                            return;
                        } catch (err: unknown) {
                            const status = (err as { response?: { status?: number } })?.response?.status;
                            if (status === 401 || status === 403) break;
                            attempts++;
                            await new Promise(r => setTimeout(r, 1200));
                        }
                    }

                    set({ status: 'error', error: 'Biometric sign-in failed — could not verify identity' });
                } catch (error) {
                    set({ status: 'error', error: 'Biometric sign-in failed' });
                }
            },

            logout: async () => {
                // Capture the tenant we're leaving BEFORE clearing any state/storage, so
                // re-login returns to the SAME tenant rather than a default one: URL path
                // first (every tenant page is /{orgSlug}/...), then the signed-in profile,
                // then the last-used localStorage hint. Never a hardcoded tenant.
                let slug = '';
                if (typeof window !== 'undefined') {
                    const first = window.location.pathname.split('/').filter(Boolean)[0] ?? '';
                    if (first && first !== 'auth') slug = first;
                }
                slug = slug || get().user?.tenant_slug || '';

                const token = get().session?.accessToken;
                await revokeServerSession(token);
                set({ status: 'idle', user: null, session: null, subscriptionInfo: undefined, lastAuthenticatedAt: null });
                apiClient.setAccessToken(null);
                apiClient.setTenantInfo(null, null);
                // Drop the outlet context too — a retained outlet (store + X-Outlet-ID +
                // 'inventory-selected-outlet-id') leaks into the NEXT tenant's session when
                // the user logs into a different org slug, sending the old tenant's outlet
                // header on early requests. Mirrors erp-ui's logout.
                try { useOutletStore.getState().clearOutlet(); } catch { /* no-op */ }
                if (typeof window !== 'undefined') {
                    try { slug = slug || (localStorage.getItem('tenantSlug') ?? ''); } catch { /* no-op */ }
                    try { localStorage.removeItem('tenantId'); } catch { /* no-op */ }
                    // Keep `tenantSlug` as the last-used hint so the bare-root landing routes back here.
                    try { localStorage.removeItem('inventory-auth-storage'); } catch { /* no-op */ }
                    try { localStorage.removeItem('inventory-outlet-storage'); } catch { /* no-op */ }
                    try { sessionStorage.clear(); } catch { /* no-op */ }
                    // Land on the tenant app root: arriving there unauthenticated re-triggers
                    // SSO with tenant=<slug>, so the login screen shows the RIGHT organisation.
                    window.location.href = slug
                        ? buildLogoutUrl(`${window.location.origin}/${slug}`)
                        : buildLogoutUrl(`https://accounts.codevertexitsolutions.com/login?return_to=${encodeURIComponent(window.location.origin)}`);
                }
            },

            fetchUser: async () => {
                const { user } = get();
                const slug = user?.tenant_slug
                    ?? (typeof window !== 'undefined' ? localStorage.getItem('tenantSlug') : null)
                    ?? '';
                try {
                    const freshUser = await fetchInventoryProfile(slug);
                    set({ user: freshUser });
                } catch (error) {
                    console.error('Fetch user failed:', error);
                }
            },
        }),
        {
            name: 'inventory-auth-storage',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                session: state.session,
                user: state.user,
            }),
        }
    )
);
