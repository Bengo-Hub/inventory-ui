'use client';

import { useEffect } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { useOutletStore, INVENTORY_SELECTED_OUTLET_KEY, type OutletInfo } from '@/store/outlet';

/**
 * OutletGate — enforces the "log into a warehouse/outlet" step on every dashboard entry,
 * mirroring the POS PIN-login outlet selector. If an authenticated user reaches a dashboard
 * route without having chosen an outlet (no selection marker and no active outlet in the
 * store), they're sent to the select-outlet gate. "All Outlets" (HQ) counts as a choice —
 * it writes the 'all' marker — so HQ users are not bounced.
 *
 * Also validates the remembered choice is still real: a stored outlet id that's since been
 * archived/deactivated/unassigned (an admin removed the branch, or reassigned this user
 * elsewhere) previously left the session silently pinned to a dead outlet — same /my-outlets
 * source select-outlet itself trusts, so this can never disagree with what a fresh visit to
 * that page would decide. Renders nothing.
 */
export function OutletGate() {
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const orgSlug = params?.orgSlug as string | undefined;
  const status = useAuthStore((s) => s.status);
  const outlet = useOutletStore((s) => s.outlet);
  const isAuthRoute = !!pathname && pathname.includes('/auth/');

  const { data: myOutlets } = useQuery({
    queryKey: ['my-outlets-validity', orgSlug],
    queryFn: () => apiClient.get<{ data: OutletInfo[] } | OutletInfo[]>(`/api/v1/${orgSlug}/inventory/my-outlets`),
    enabled: status === 'authenticated' && !!orgSlug && !isAuthRoute,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (status !== 'authenticated' || !orgSlug || isAuthRoute) return;

    let marker: string | null = null;
    try {
      marker = localStorage.getItem(INVENTORY_SELECTED_OUTLET_KEY);
    } catch {
      marker = null;
    }
    const returnTo = encodeURIComponent(pathname ?? `/${orgSlug}`);

    // Chosen = an explicit selection marker ('all' or an outlet id) OR an active outlet.
    if (!marker && !outlet) {
      router.replace(`/${orgSlug}/auth/select-outlet?returnTo=${returnTo}`);
      return;
    }
    if (marker === 'all' || !myOutlets) return; // HQ superset always valid; validity data not loaded yet

    const rows = Array.isArray(myOutlets) ? myOutlets : myOutlets.data ?? [];
    const activeIds = new Set(rows.filter((o) => o.status !== 'inactive').map((o) => o.id));
    const storedId = outlet?.id ?? marker;
    if (storedId && !activeIds.has(storedId)) {
      router.replace(`/${orgSlug}/auth/select-outlet?returnTo=${returnTo}`);
    }
  }, [status, orgSlug, pathname, outlet, router, myOutlets, isAuthRoute]);

  return null;
}
