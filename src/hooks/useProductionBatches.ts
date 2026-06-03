'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { productionBatchesApi, type CreateBatchInput, type BatchListParams, type PaginatedBatches } from '@/lib/api/productionBatches';

const KEY = 'production-batches';
const EMPTY: PaginatedBatches = { data: [], total: 0, page: 1, limit: 20, hasMore: false };

export function useProductionBatches(org: string, params?: BatchListParams) {
  return useQuery<PaginatedBatches>({
    queryKey: [KEY, org, params],
    queryFn: () => productionBatchesApi.list(org, params),
    enabled: !!org,
    placeholderData: EMPTY,
    staleTime: 60_000,
  });
}

export function useCreateBatch(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBatchInput) => productionBatchesApi.create(org, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useStartBatch(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => productionBatchesApi.start(org, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useCompleteBatch(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actualQuantity }: { id: string; actualQuantity: number }) =>
      productionBatchesApi.complete(org, id, actualQuantity),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useCancelBatch(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => productionBatchesApi.cancel(org, id, reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}
