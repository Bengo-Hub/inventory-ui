'use client';

import { useRouter, useParams } from 'next/navigation';
import { IdleScreensaver } from '@/components/idle-screensaver';
import { useAuthStore } from '@/store/auth';
import { useOutletStore, INVENTORY_SELECTED_OUTLET_KEY } from '@/store/outlet';
import { resolveIdleSeconds, useScreensaverSetting } from '@/hooks/use-screensaver-timeout';

/**
 * DashboardScreensaver — mounts the branded idle screensaver across the
 * authenticated dashboard. On wake it forces re-auth for the next staff member:
 * the active outlet session is cleared and the user is returned to the outlet
 * login gate. Must render inside BrandingProvider (for the tenant logo) and the
 * auth tree (for the stores).
 */
export function DashboardScreensaver() {
  const router = useRouter();
  const params = useParams();
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
    // Drop the active outlet session so the gate re-runs for the next user.
    clearOutlet();
    try {
      localStorage.removeItem(INVENTORY_SELECTED_OUTLET_KEY);
    } catch {
      /* ignore */
    }
    router.replace(`/${orgSlug}/auth/select-outlet`);
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
