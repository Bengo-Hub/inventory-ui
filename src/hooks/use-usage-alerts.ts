'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth';
// UsageAlert is not yet exported by shared-ui-lib — define locally.
interface UsageAlert {
  metric:   string;
  used:     number;
  limit:    number;
  pct:      number;
  severity: 'warning' | 'critical';
}

const SUBSCRIPTIONS_API_URL =
  process.env.NEXT_PUBLIC_SUBSCRIPTIONS_API_URL ||
  'https://pricingapi.codevertexitsolutions.com';

export function useUsageAlerts(): UsageAlert[] {
  const token = useAuthStore((s) => s.session?.accessToken);
  const user = useAuthStore((s) => s.user);
  const isPlatformOwner =
    !!(user as any)?.is_platform_owner || (user as any)?.tenant_slug === 'codevertex';

  const { data } = useQuery<UsageAlert[]>({
    queryKey: ['usage-alerts', (user as any)?.tenant_id],
    queryFn: async () => {
      const resp = await fetch(`${SUBSCRIPTIONS_API_URL}/api/v1/usage/alerts`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Tenant-ID': (user as any)?.tenant_id ?? '',
          'X-Tenant-Slug': (user as any)?.tenant_slug ?? '',
        },
      });
      if (!resp.ok) return [];
      const json = await resp.json();
      return (json.alerts ?? []) as UsageAlert[];
    },
    enabled: !!token && !!user && !isPlatformOwner,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  return data ?? [];
}
