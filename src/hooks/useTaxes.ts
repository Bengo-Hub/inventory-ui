import { useQuery } from '@tanstack/react-query';
import { taxesApi } from '@/lib/api/taxes';

/** Tenant tax codes, sourced + cached from treasury-api via inventory-api. */
export function useTaxes(orgSlug: string) {
  return useQuery({
    queryKey: ['taxes', orgSlug],
    queryFn: () => taxesApi.list(orgSlug),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 300_000,
  });
}
