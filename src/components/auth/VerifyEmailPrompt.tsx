'use client';

import { VerifyEmailBanner, type EmailVerificationState } from '@bengo-hub/shared-ui-lib/auth';
import { useAuthStore } from '@/store/auth';

// auth-api (SSO) hosts the authenticated verify endpoints. The embedded OTP dialog calls
// them directly with the user's Bearer token — auth-api CORS allows POST + Authorization
// from these origins — so the user never leaves the app to verify.
const AUTH_BASE =
  process.env.NEXT_PUBLIC_SSO_URL ||
  process.env.NEXT_PUBLIC_AUTH_URL ||
  'https://sso.codevertexitsolutions.com';

async function postVerify(path: string, body: unknown): Promise<void> {
  const token = useAuthStore.getState().session?.accessToken;
  const res = await fetch(`${AUTH_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = 'Request failed. Please try again.';
    try {
      const data = await res.json();
      msg = data.message || data.error || msg;
    } catch {
      /* non-JSON body */
    }
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
      onSendCode={(email) => postVerify('/api/v1/auth/me/email/send-code', { email })}
      onVerifyCode={(email, code) => postVerify('/api/v1/auth/me/email/verify-code', { email, code })}
      onVerified={refetch}
    />
  );
}
