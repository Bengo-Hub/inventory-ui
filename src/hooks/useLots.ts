'use client';

import { useQuery } from '@tanstack/react-query';
import { lotsApi, type LotListParams } from '@/lib/api/lots';

const LOTS_KEY = 'lots';

export function useLots(orgSlug: string, params?: LotListParams) {
  return useQuery({
    queryKey: [LOTS_KEY, orgSlug, params],
    queryFn: () => lotsApi.list(orgSlug, params),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 60_000,
  });
}
