'use client';

import { VerifyEmailBanner, type EmailVerificationState } from '@bengo-hub/shared-ui-lib/auth';
import { useAuthStore } from '@/store/auth';

// Accounts portal where users complete verification (add/replace a real email, enter the
// code). Back-office apps deep-link here rather than embedding the cross-origin dialog.
const ACCOUNTS_VERIFY_URL =
  (process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.codevertexitsolutions.com') +
  '/dashboard/profile';

/**
 * Renders the shared graduated verify banner from the email_verification block that
 * inventory-api's /auth/me forwards from auth-api. Verification itself happens in the
 * accounts portal (deep-linked), so no cross-origin verify calls are needed here.
 */
export function VerifyEmailPrompt() {
  const user = useAuthStore((s) => s.user);
  const state = user?.email_verification as EmailVerificationState | undefined;
  if (!state || state.verified) return null;
  return <VerifyEmailBanner state={state} verifyUrl={ACCOUNTS_VERIFY_URL} />;
}
