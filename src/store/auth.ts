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
import { cookieMode } from '@/lib/auth/session-mode';
import { isTerminalSession } from '@/lib/auth/session-kind';
import { scrubStoredSession } from '@bengo-hub/shared-ui-lib/auth';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const AUTH_STORAGE_KEY = 'inventory-auth-storage';

/** True when the stored session is a PIN desk's terminal JWT (kept across reloads). */
function storedTerminalSession(): boolean {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        const parsed = raw ? (JSON.parse(raw) as { state?: { session?: { accessToken?: string } } }) : null;
        return isTerminalSession(parsed?.state?.session?.accessToken);
    } catch {
        return false;
    }
}

// Cookie session (fleet plan G11): sso tokens an earlier build stored are dropped before the store
// loads; from here on an sso sign-in persists only the profile. A PIN desk's terminal JWT has no
// sso cookie behind it, so it stays stored and the desk stays signed in across reloads.
if (cookieMode() && !storedTerminalSession()) scrubStoredSession(AUTH_STORAGE_KEY);

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
    /** Ends this tab's session locally (no SSO logout, no navigation) — used to lock a shared
     *  PIN terminal on idle so the next staff member must enter their own PIN. */
    endLocalSession: () => void;
    fetchUser: () => Promise<void>;
}

/**
 * Cookie session: hands a fresh sign-in's refresh token to auth-api's HttpOnly cookie. The cookie
 * session's onChange mirrors the access token into the store and the API client. True when the
 * store now holds that token.
 */
async function startCookieSession(refreshToken: string): Promise<boolean> {
    const { getCookieSession } = await import('@/lib/auth/cookie-session');
    // A new sign-in replaces whoever was stored, so it is not taken for a user switch.
    useAuthStore.setState({ user: null, session: null });
    const started = await getCookieSession().start(refreshToken);
    return 'token' in started && !!useAuthStore.getState().session;
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
                // A stored PIN terminal session takes the stored-token path below, as before.
                if (cookieMode() && !isTerminalSession(get().session?.accessToken)) {
                    // No sso token is stored: a known profile gets its first token through the
                    // sso cookie.
                    const known = get().user;
                    if (!known) {
                        set({ status: 'idle' });
                        return;
                    }
                    set({ status: 'loading' });
                    const { getCookieSession } = await import('@/lib/auth/cookie-session');
                    const renewed = await getCookieSession().refresh();
                    if (!('token' in renewed)) {
                        // A transient failure (auth-api unreachable) keeps the profile, so the next
                        // load tries again; a refused cookie drops it.
                        set('transient' in renewed
                            ? { status: 'idle', session: null }
                            : { status: 'idle', session: null, user: null });
                        return;
                    }
                    apiClient.setTenantInfo(known.tenant_id, known.tenant_slug);
                    set({ status: 'authenticated', lastAuthenticatedAt: Date.now() });
                    return;
                }
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
                    // Expired (e.g. a reload of a tab left open overnight): refresh first. The
                    // profile call below goes to /auth/me, which the API client deliberately never
                    // refreshes for, so without this an expired-but-refreshable session was
                    // dropped straight to the login/PIN page on every such reload.
                    if (session.refreshToken) {
                        try {
                            const { refreshAccessToken } = await import('@/lib/auth/token-refresh');
                            const fresh = await refreshAccessToken(session.accessToken);
                            if (fresh) {
                                apiClient.setAccessToken(fresh);
                                set({ status: 'authenticated', lastAuthenticatedAt: Date.now() });
                                return;
                            }
                        } catch {
                            // auth-api unreachable right now — keep the stored session; the API
                            // client refreshes again on the next 401 once it's reachable.
                            set({ status: 'authenticated', lastAuthenticatedAt: Date.now() });
                            return;
                        }
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

                    if (cookieMode()) {
                        // The refresh token goes into auth-api's HttpOnly cookie and is dropped
                        // here; the store holds only the in-memory access token it hands back.
                        if (!(await startCookieSession(session.refreshToken))) {
                            set({ status: 'error', error: 'Sign-in failed' });
                            return;
                        }
                    } else {
                        apiClient.setAccessToken(session.accessToken);
                        set({ session });
                    }

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

                    if (cookieMode() && session.refreshToken) {
                        // Biometric sign-in hands back sso tokens: move them onto the cookie the
                        // same way as the SSO callback.
                        if (!(await startCookieSession(session.refreshToken))) {
                            set({ status: 'error', error: 'Biometric sign-in failed' });
                            return;
                        }
                    } else {
                        // A PIN terminal JWT (no refresh token). It is stored as before, also in
                        // the cookie session, so the desk stays signed in across reloads.
                        apiClient.setAccessToken(session.accessToken);
                        set({ session });
                    }

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
                if (cookieMode() && !isTerminalSession(token)) {
                    // Revokes the session, clears the sso cookie and signs the other tabs out.
                    const { getCookieSession } = await import('@/lib/auth/cookie-session');
                    await getCookieSession().end();
                } else {
                    await revokeServerSession(token);
                }
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
                    try { localStorage.removeItem(AUTH_STORAGE_KEY); } catch { /* no-op */ }
                    try { localStorage.removeItem('inventory-outlet-storage'); } catch { /* no-op */ }
                    try { sessionStorage.clear(); } catch { /* no-op */ }
                    // Land on the tenant app root: arriving there unauthenticated re-triggers
                    // SSO with tenant=<slug>, so the login screen shows the RIGHT organisation.
                    window.location.href = slug
                        ? buildLogoutUrl(`${window.location.origin}/${slug}`)
                        : buildLogoutUrl(`https://accounts.codevertexafrica.com/login?return_to=${encodeURIComponent(window.location.origin)}`);
                }
            },

            endLocalSession: () => {
                set({ status: 'idle', user: null, session: null, subscriptionInfo: undefined, lastAuthenticatedAt: null });
                apiClient.setAccessToken(null);
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
            name: AUTH_STORAGE_KEY,
            storage: createJSONStorage(() => localStorage),
            // The cookie session persists an sso sign-in's profile only; its access token stays in
            // memory. A PIN desk's terminal JWT is stored as before, so the desk survives a reload.
            partialize: (state) => (cookieMode() && !isTerminalSession(state.session?.accessToken)
                ? { user: state.user }
                : { session: state.session, user: state.user }),
        }
    )
);
