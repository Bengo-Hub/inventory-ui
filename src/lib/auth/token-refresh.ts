/**
 * Access-token refresh for inventory-ui, built on the shared cross-tab-safe refresher
 * (@bengo-hub/shared-ui-lib/auth createSessionRefresher). Before spending the refresh token it
 * picks up a newer session another tab saved, tabs take turns refreshing, and an enrolment-only
 * answer counts as signed out. See the shared module for the full story.
 */

import { createSessionRefresher } from '@bengo-hub/shared-ui-lib/auth';
import { useAuthStore } from '@/store/auth';
import { refreshTokens } from '@/lib/auth/api';
import { cookieMode } from '@/lib/auth/session-mode';
import { isTerminalSession } from '@/lib/auth/session-kind';

/** The persisted store key; also names the cross-tab refresh lock and the storage watcher. */
export const AUTH_STORAGE_KEY = 'inventory-auth-storage';

/** Thrown when auth-api couldn't be reached or errored (network, timeout, 5xx/429). The session
 *  may still be perfectly valid, so callers must NOT log the user out on this, only on null. */
export class RefreshUnavailableError extends Error {}

const refreshSession = createSessionRefresher({
  lockName: AUTH_STORAGE_KEY,
  getSession: () => useAuthStore.getState().session,
  reloadSession: () => useAuthStore.persist.rehydrate(),
  saveSession: (session) => useAuthStore.setState({ session }),
  refresh: refreshTokens,
});

/**
 * Returns a usable access token, or null when the session is genuinely over (no refresh token,
 * or auth-api refused it). Throws RefreshUnavailableError on a transient failure. Pass the token
 * the server just rejected when it is known.
 */
export async function refreshAccessToken(failedToken?: string | null): Promise<string | null> {
  // The cookie session refreshes through auth-api's HttpOnly cookie (lib/auth/cookie-session.ts).
  // A PIN terminal JWT has no refresh path, as before: the sso cookie may belong to someone else.
  if (cookieMode()) {
    if (isTerminalSession(useAuthStore.getState().session?.accessToken)) return null;
    const { getCookieSession } = await import('@/lib/auth/cookie-session');
    const renewed = await getCookieSession().refresh(failedToken);
    if ('token' in renewed) return renewed.token;
    if ('transient' in renewed) throw new RefreshUnavailableError('Token refresh temporarily unavailable');
    return null;
  }
  const outcome = await refreshSession(failedToken);
  if ('token' in outcome) return outcome.token;
  if ('transient' in outcome) throw new RefreshUnavailableError('Token refresh temporarily unavailable');
  return null;
}
