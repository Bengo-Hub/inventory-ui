/**
 * The cookie session for inventory-ui (fleet plan G11; shared-ui-lib createCookieSession).
 *
 * The refresh token lives in auth-api's HttpOnly cookie on sso.codevertexafrica.com, out of reach
 * of page scripts. The access token lives in memory. The store's `session` stays the in-memory
 * mirror that every caller already reads (refreshToken is always empty, and the store never
 * persists it in this mode), so no component changes.
 *
 * A shared-desk PIN session holds an inventory-api terminal JWT, not an sso token. The cookie
 * belongs to whoever last signed in on this browser, so a tab on a PIN session ignores it. That
 * terminal JWT stays stored (store/auth.ts), so the desk stays signed in across reloads.
 */

import { createCookieSession, type CookieSession, type CookieSessionState } from '@bengo-hub/shared-ui-lib/auth';
import { apiClient } from '@/lib/api/client';
import { isTerminalSession } from '@/lib/auth/session-kind';
import { useAuthStore } from '@/store/auth';

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_URL || 'https://sso.codevertexafrica.com';
const SSO_CLIENT_ID = process.env.NEXT_PUBLIC_SSO_CLIENT_ID || 'inventory-ui';

let current: CookieSession | null = null;

/** The store's session shape for an in-memory access token. */
function mirror(s: CookieSessionState) {
  return { accessToken: s.accessToken, refreshToken: '', expiresAt: new Date(s.expiresAt).toISOString() };
}

/**
 * Keeps the store and the API client in step with the cookie session, including a token or a
 * sign-out another tab shared. When a different person signs in elsewhere (one sso cookie serves
 * every app), this tab drops its profile and tenant choice and reloads as that person.
 */
function onChange(s: CookieSessionState | null) {
  const store = useAuthStore.getState();
  if (isTerminalSession(store.session?.accessToken)) return;
  if (!s) {
    apiClient.setAccessToken(null);
    if (store.session || store.status === 'authenticated') useAuthStore.setState({ session: null, status: 'idle' });
    return;
  }
  const nextUserId = (s.payload.user as { id?: string } | undefined)?.id;
  if (store.user && nextUserId && nextUserId !== store.user.id) {
    useAuthStore.setState({ user: null, session: null, subscriptionInfo: undefined, status: 'idle' });
    try {
      localStorage.removeItem('tenantId');
      localStorage.removeItem('tenantSlug');
      localStorage.removeItem('inventory-outlet-storage');
      localStorage.removeItem('inventory-selected-outlet-id');
    } catch {
      /* no storage */
    }
    window.location.reload();
    return;
  }
  apiClient.setAccessToken(s.accessToken);
  useAuthStore.setState({ session: mirror(s) });
}

export function getCookieSession(): CookieSession {
  current ??= createCookieSession({ authBaseUrl: SSO_BASE_URL, clientId: SSO_CLIENT_ID, onChange });
  return current;
}
