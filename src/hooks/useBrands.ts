'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { brandsApi, type Brand, type BrandPayload } from '@/lib/api/brands';

const BRANDS_KEY = 'brands';

// Brands are tenant-scoped reference data (not outlet/use_case-scoped), mirroring the
// backend ItemBrand master — a brand like "HP" applies across every outlet.
export function useBrands(orgSlug: string) {
  return useQuery<Brand[]>({
    queryKey: [BRANDS_KEY, orgSlug],
    queryFn: () => brandsApi.list(orgSlug),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 120_000,
  });
}

export function useCreateBrand(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BrandPayload) => brandsApi.create(orgSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BRANDS_KEY, orgSlug] });
    },
  });
}

export function useDeleteBrand(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => brandsApi.delete(orgSlug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BRANDS_KEY, orgSlug] });
    },
  });
}

export type { Brand };
