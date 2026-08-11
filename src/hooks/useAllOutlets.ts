'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
import { isInventoryApplicableUseCase } from '@/lib/use-case-nomenclature';

const AUTH_API_URL =
  process.env.NEXT_PUBLIC_AUTH_API_URL ||
  process.env.NEXT_PUBLIC_SSO_URL ||
  'https://sso.codevertexafrica.com';

export interface OutletListItem {
  id: string;
  code: string;
  name: string;
  use_case?: string;
  is_hq?: boolean;
  status?: string;
}

async function fetchOutlets(accessToken: string, tenantSlug: string): Promise<OutletListItem[]> {
  const res = await fetch(`${AUTH_API_URL}/api/v1/tenants/${tenantSlug}/outlets`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const list: OutletListItem[] = Array.isArray(data) ? data : data.outlets ?? data.data ?? [];
  return list.filter((o) => o.status !== 'archived');
}

/**
 * useAllOutlets — the tenant's FULL outlet list (unlike /my-outlets, which is
 * assignment-filtered for the login gate). For admin/manager-only surfaces that need every
 * outlet regardless of the caller's own assignment: the header's OutletFilter drill-down and
 * the export dialogs' outlet/warehouse scope pickers both use this — previously each fetched
 * from a different endpoint (OutletFilter: auth-api directly; exports: inventory-api's
 * `/outlets`, unfiltered), so they could silently disagree on what "every outlet" means.
 * Filters out non-inventory-applicable outlets (logistics/weighbridge/enforcement) the same way
 * OutletFilter always has. Callers should still gate visibility with `canAccessAllOutlets` —
 * this hook does not itself check the caller's role.
 */
export function useAllOutlets(enabled = true) {
  const user = useAuthStore((s) => s.user);
  const session = useAuthStore((s) => s.session);
  const slug = (user as any)?.tenantSlug || (user as any)?.tenant_slug || '';

  const query = useQuery<OutletListItem[]>({
    queryKey: ['outlet_list', slug],
    queryFn: () => fetchOutlets(session?.accessToken ?? '', slug),
    enabled: enabled && !!session?.accessToken && !!slug,
    staleTime: 5 * 60_000,
  });

  const outlets = (query.data ?? []).filter((o) => isInventoryApplicableUseCase(o.use_case));
  return { ...query, data: outlets };
}
