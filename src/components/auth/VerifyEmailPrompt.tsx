'use client';

import { VerifyEmailBanner, type EmailVerificationState } from '@bengo-hub/shared-ui-lib/auth';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/lib/api/client';

/**
 * Routed through inventory-api (which proxies on to auth-api's S2S endpoint — see
 * inventory-api's AuthHandler.proxyEmailCode) rather than calling auth-api directly with the
 * user's own session token. Two reasons that matters: apiClient's existing 401-retry-with-
 * refresh interceptor now covers this call too (an SSO token that expired while this dialog
 * sat open used to just fail with no recovery — the OTP dialog can force a wait of a minute
 * or more before it's even usable), and it works for a terminal/PIN session, whose token is
 * signed with inventory-api's own HMAC secret — auth-api has no key to verify that token and
 * would reject it outright with "missing or invalid auth" no matter how fresh it was.
 */
async function postVerify(path: string, body: unknown): Promise<void> {
  const tenantSlug = useAuthStore.getState().user?.tenant_slug;
  if (!tenantSlug) throw new Error('No active organisation — please sign in again.');
  try {
    await apiClient.post(`/api/v1/${tenantSlug}${path}`, body);
  } catch (e) {
    const err = e as { response?: { data?: { message?: string; error?: string } } };
    const msg = err.response?.data?.message || err.response?.data?.error || 'Request failed. Please try again.';
    throw new Error(msg);
  }
}

/**
 * Graduated verify-email banner + embedded OTP dialog. The email_verification block is
 * forwarded on /me; verification (enter/confirm email → 6-digit code → verified) happens
 * in-app against auth-api. On success we refetch /me so the banner clears and the now-real
 * email propagates.
 */
export function VerifyEmailPrompt() {
  const state = useAuthStore((s) => s.user?.email_verification) as EmailVerificationState | undefined;
  if (!state || state.verified) return null;

  const refetch = async () => {
    const store = useAuthStore.getState() as { fetchUser?: () => Promise<void> };
    if (typeof store.fetchUser === 'function') await store.fetchUser();
    else if (typeof window !== 'undefined') window.location.reload();
  };

  return (
    <VerifyEmailBanner
      state={state}
      onSendCode={(email) => postVerify('/auth/verify-email/send-code', { email })}
      onVerifyCode={(email, code) => postVerify('/auth/verify-email/verify-code', { email, code })}
      onVerified={refetch}
    />
  );
}
