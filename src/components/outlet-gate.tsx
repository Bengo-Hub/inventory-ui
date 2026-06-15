'use client';

import { useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useOutletStore, INVENTORY_SELECTED_OUTLET_KEY } from '@/store/outlet';

/**
 * OutletGate — enforces the "log into a warehouse/outlet" step on every dashboard entry,
 * mirroring the POS PIN-login outlet selector. If an authenticated user reaches a dashboard
 * route without having chosen an outlet (no selection marker and no active outlet in the
 * store), they're sent to the select-outlet gate. "All Outlets" (HQ) counts as a choice —
 * it writes the 'all' marker — so HQ users are not bounced. Renders nothing.
 */
export function OutletGate() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const orgSlug = params?.orgSlug as string | undefined;
  const status = useAuthStore((s) => s.status);
  const outlet = useOutletStore((s) => s.outlet);

  useEffect(() => {
    if (status !== 'authenticated' || !orgSlug) return;
    // Don't interfere with the auth/select-outlet screens themselves.
    if (pathname && pathname.includes('/auth/')) return;

    let hasMarker = false;
    try {
      hasMarker = !!localStorage.getItem(INVENTORY_SELECTED_OUTLET_KEY);
    } catch {
      hasMarker = false;
    }
    // Chosen = an explicit selection marker ('all' or an outlet id) OR an active outlet.
    if (hasMarker || outlet) return;

    const returnTo = encodeURIComponent(pathname ?? `/${orgSlug}`);
    router.replace(`/${orgSlug}/auth/select-outlet?returnTo=${returnTo}`);
  }, [status, orgSlug, pathname, outlet, router]);

  return null;
}
