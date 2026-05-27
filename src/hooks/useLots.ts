'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lotsApi, type LotListParams, type CreateLotInput, type UpdateLotInput } from '@/lib/api/lots';

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

export function useCreateLot(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLotInput) => lotsApi.create(orgSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOTS_KEY, orgSlug] });
    },
  });
}

export function useUpdateLot(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLotInput }) => lotsApi.update(orgSlug, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOTS_KEY, orgSlug] });
    },
  });
}

export function useDeleteLot(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => lotsApi.delete(orgSlug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [LOTS_KEY, orgSlug] });
    },
  });
}
