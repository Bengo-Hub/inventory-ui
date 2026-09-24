'use client';

import { useRouter, useParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { IdleScreensaver } from '@/components/idle-screensaver';
import { useAuthStore } from '@/store/auth';
import { useOutletStore, INVENTORY_SELECTED_OUTLET_KEY } from '@/store/outlet';
import { resolveIdleSeconds, useScreensaverSetting } from '@/hooks/use-screensaver-timeout';
import { isTerminalSession } from '@/lib/auth/session-kind';

/**
 * DashboardScreensaver — mounts the branded idle screensaver across the authenticated dashboard.
 *
 * Waking it behaves differently by session kind:
 * - Personal account (SSO / biometric): just dismisses the screensaver. The page — including any
 *   open, half-filled dialog — stays exactly as it was; there is no "next staff member".
 * - Shared-desk PIN session: locks the terminal. The session and outlet are cleared and the user
 *   is sent to the PIN pad with a returnTo, so the next person must enter their own PIN and lands
 *   back on the same page.
 *
 * Previously every wake cleared the outlet and router.replace'd to outlet selection while the
 * session stayed signed in: select-outlet / pin-login then auto-forwarded straight back, so the
 * visible effect was a reload-and-bounce that discarded unsaved work (e.g. the catalog item
 * dialog) without ever actually asking anyone to re-authenticate.
 */
export function DashboardScreensaver() {
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const orgSlug = params?.orgSlug as string | undefined;
  const status = useAuthStore((s) => s.status);
  const clearOutlet = useOutletStore((s) => s.clearOutlet);
  // Effective timeout = service_config (tenant/platform) → device override → default.
  const { data: setting } = useScreensaverSetting(
    status === 'authenticated' ? orgSlug : undefined,
  );
  const timeoutSeconds = resolveIdleSeconds(setting?.config_value);

  const handleWake = () => {
    if (!orgSlug) return;
    const token = useAuthStore.getState().session?.accessToken;
    if (!isTerminalSession(token)) return;

    const returnTo = window.location.pathname + window.location.search;
    clearOutlet();
    try {
      localStorage.removeItem(INVENTORY_SELECTED_OUTLET_KEY);
      // The auth provider's idle-session effect would otherwise try a silent SSO probe (a
      // full-page redirect) — a PIN terminal must go straight to the PIN pad.
      sessionStorage.setItem('sso_silent_done', '1');
    } catch {
      /* ignore */
    }
    queryClient.clear();
    useAuthStore.getState().endLocalSession();
    router.replace(`/${orgSlug}/auth/pin-login?returnTo=${encodeURIComponent(returnTo)}`);
  };

  // Only run while authenticated on a dashboard route.
  return (
    <IdleScreensaver
      enabled={status === 'authenticated'}
      timeoutSeconds={timeoutSeconds}
      onWake={handleWake}
    />
  );
}
