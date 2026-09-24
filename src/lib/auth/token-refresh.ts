/**
 * Token refresh manager with mutex to prevent concurrent refresh attempts.
 * When a 401 is received, all pending callers share a single refresh request.
 */

import { useAuthStore } from '@/store/auth';
import { refreshTokens } from '@/lib/auth/api';

let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

/** Thrown when auth-api couldn't be reached or errored (network, timeout, 5xx/429). The session
 *  may still be perfectly valid, so callers must NOT log the user out on this — only on null. */
export class RefreshUnavailableError extends Error {}

/**
 * Attempt to refresh the access token using the stored refresh token.
 * Returns the new access token, or null when the session is genuinely over (no refresh token,
 * or auth-api rejected it). Throws RefreshUnavailableError on a transient failure.
 * Concurrent calls share the same in-flight refresh request (mutex).
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    const before = useAuthStore.getState().session?.accessToken;
    // Another tab may already have refreshed (the session is persisted to localStorage, but
    // zustand doesn't sync it across tabs on its own). Adopt its token rather than spending our
    // older refresh token, which auth-api may already have rotated away.
    try {
      await useAuthStore.persist.rehydrate();
    } catch {
      /* storage unavailable — fall through to a normal refresh */
    }
    const session = useAuthStore.getState().session;
    if (session?.accessToken && session.accessToken !== before && session.expiresAt
      && new Date(session.expiresAt).getTime() > Date.now() + 60_000) {
      return session.accessToken;
    }
    if (!session?.refreshToken) return null;
    return doRefresh(session.refreshToken);
  })();

  try {
    return await refreshPromise;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

async function doRefresh(currentRefreshToken: string): Promise<string | null> {
  let data: Awaited<ReturnType<typeof refreshTokens>>;
  try {
    data = await refreshTokens(currentRefreshToken);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 400 || status === 401 || status === 403) return null;
    throw new RefreshUnavailableError('Token refresh temporarily unavailable');
  }
  const newAccessToken = data.access_token;
  const newRefreshToken = data.refresh_token || currentRefreshToken;
  const expiresIn = data.expires_in || 3600;

  useAuthStore.setState({
    session: {
      ...useAuthStore.getState().session!,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    },
  });

  return newAccessToken;
}
