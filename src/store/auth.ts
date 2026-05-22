import { apiClient } from '@/lib/api/client';
import { buildAuthorizeUrl, buildLogoutUrl, exchangeCodeForTokens, fetchProfile } from '@/lib/auth/api';
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
    redirectToSSO: (orgSlug: string, returnTo?: string) => Promise<void>;
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

                try {
                    const freshUser = await fetchProfile();
                    apiClient.setTenantInfo(freshUser.tenant_id, freshUser.tenant_slug);
                    set({ user: freshUser, status: 'authenticated', lastAuthenticatedAt: Date.now() });
                } catch (error) {
                    console.error('Failed to initialize auth:', error);
                    set({ status: 'idle', session: null, user: null });
                }
            },

            redirectToSSO: async (orgSlug: string, returnTo?: string) => {
                set({ status: 'loading', error: null });
                try {
                    const verifier = generateCodeVerifier();
                    const challenge = await generateCodeChallenge(verifier);
                    const state = generateState();

                    storeVerifier(verifier);
                    storeState(state);

                    if (returnTo && typeof window !== 'undefined') {
                        sessionStorage.setItem('sso_return_to', returnTo);
                    }

                    const callbackUrl = `${window.location.origin}/${orgSlug}/auth/callback`;
                    const authorizeUrl = buildAuthorizeUrl({
                        codeChallenge: challenge,
                        state,
                        redirectUri: callbackUrl,
                        tenant: orgSlug,
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

                    let attempts = 0;
                    while (attempts < 5) {
                        try {
                            const user = await fetchProfile();
                            apiClient.setTenantInfo(user.tenant_id, user.tenant_slug);
                            if (typeof window !== 'undefined' && user?.email) {
                                localStorage.setItem('sso_last_email', user.email);
                            }
                            set({ user, status: 'authenticated', lastAuthenticatedAt: Date.now() });
                            return;
                        } catch {
                            attempts++;
                            await new Promise(r => setTimeout(r, 1500));
                        }
                    }

                    set({ status: 'authenticated', lastAuthenticatedAt: Date.now() });
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

                    let attempts = 0;
                    while (attempts < 5) {
                        try {
                            const user = await fetchProfile();
                            apiClient.setTenantInfo(user.tenant_id, user.tenant_slug);
                            if (typeof window !== 'undefined' && user?.email) {
                                localStorage.setItem('sso_last_email', user.email);
                            }
                            set({ user, status: 'authenticated', lastAuthenticatedAt: Date.now() });
                            return;
                        } catch {
                            attempts++;
                            await new Promise(r => setTimeout(r, 1500));
                        }
                    }

                    set({ status: 'authenticated', lastAuthenticatedAt: Date.now() });
                } catch (error) {
                    set({ status: 'error', error: 'Biometric sign-in failed' });
                }
            },

            logout: async () => {
                set({ status: 'idle', user: null, session: null, subscriptionInfo: undefined, lastAuthenticatedAt: null });
                apiClient.setAccessToken(null);
                apiClient.setTenantInfo(null, null);
                if (typeof window !== 'undefined') {
                    try { localStorage.removeItem('tenantId'); } catch { /* no-op */ }
                    try { localStorage.removeItem('tenantSlug'); } catch { /* no-op */ }
                    try { localStorage.removeItem('inventory-auth-storage'); } catch { /* no-op */ }
                    try { sessionStorage.clear(); } catch { /* no-op */ }
                    window.location.href = buildLogoutUrl('https://accounts.codevertexitsolutions.com');
                }
            },

            fetchUser: async () => {
                try {
                    const user = await fetchProfile();
                    set({ user });
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
