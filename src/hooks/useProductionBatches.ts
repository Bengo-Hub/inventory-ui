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

export function useProductionBatch(org: string, id: string) {
  return useQuery({
    queryKey: [KEY, org, id],
    queryFn: () => productionBatchesApi.get(org, id),
    enabled: !!org && !!id,
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
    mutationFn: ({ id, force }: { id: string; force?: boolean }) => productionBatchesApi.start(org, id, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useCompleteBatch(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, actualQuantity, scrapQuantity }: { id: string; actualQuantity: number; scrapQuantity?: number }) =>
      productionBatchesApi.complete(org, id, actualQuantity, scrapQuantity),
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

export function useBatchMaterials(org: string, id: string) {
  return useQuery({
    queryKey: [KEY, org, id, 'materials'],
    queryFn: () => productionBatchesApi.listMaterials(org, id),
    enabled: !!org && !!id,
    placeholderData: [],
  });
}

export function useBatchQC(org: string, id: string) {
  return useQuery({
    queryKey: [KEY, org, id, 'qc'],
    queryFn: () => productionBatchesApi.listQC(org, id),
    enabled: !!org && !!id,
    placeholderData: [],
  });
}

export function useManufacturingDashboard(org: string) {
  return useQuery({
    queryKey: [KEY, org, 'dashboard'],
    queryFn: () => productionBatchesApi.dashboard(org),
    enabled: !!org,
    staleTime: 120_000,
  });
}

export function useMaterialCheck(org: string, recipeId: string, quantity: number) {
  return useQuery({
    queryKey: [KEY, org, 'material-check', recipeId, quantity],
    queryFn: () => productionBatchesApi.materialCheck(org, recipeId, quantity),
    enabled: !!org && !!recipeId && quantity > 0,
    staleTime: 10_000,
  });
}

export function useAddQC(org: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ result, notes }: { result: string; notes?: string }) => productionBatchesApi.addQC(org, id, result, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, org, id, 'qc'] });
      qc.invalidateQueries({ queryKey: [KEY, org] });
    },
  });
}
