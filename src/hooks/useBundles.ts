'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  bundlesApi,
  type CreateBundleInput,
  type UpdateBundleInput,
  type PaginatedBundles,
} from '@/lib/api/bundles';

const BUNDLES_KEY = 'bundles';

const EMPTY: PaginatedBundles = { data: [], total: 0, page: 1, limit: 20, hasMore: false };

export function useBundles(orgSlug: string, params?: { page?: number; limit?: number }) {
  return useQuery<PaginatedBundles>({
    queryKey: [BUNDLES_KEY, orgSlug, params],
    queryFn: () => bundlesApi.list(orgSlug, params),
    enabled: !!orgSlug,
    placeholderData: EMPTY,
    staleTime: 60_000,
  });
}

export function useBundle(orgSlug: string, id: string) {
  return useQuery({
    queryKey: [BUNDLES_KEY, orgSlug, id],
    queryFn: () => bundlesApi.get(orgSlug, id),
    enabled: !!orgSlug && !!id,
  });
}

export function useCreateBundle(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBundleInput) => bundlesApi.create(orgSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUNDLES_KEY, orgSlug] });
    },
  });
}

export function useUpdateBundle(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBundleInput }) =>
      bundlesApi.update(orgSlug, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [BUNDLES_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [BUNDLES_KEY, orgSlug, id] });
    },
  });
}

export function useDeleteBundle(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => bundlesApi.delete(orgSlug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [BUNDLES_KEY, orgSlug] });
    },
  });
}
