'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  stockCountsApi,
  type CreateStockCountInput,
  type StockCountStatus,
  type UpsertLineInput,
} from '@/lib/api/stock-counts';

const KEY = 'stock-counts';

export function useStockCounts(orgSlug: string, status?: StockCountStatus) {
  return useQuery({
    queryKey: [KEY, orgSlug, status ?? 'all'],
    queryFn: () => stockCountsApi.list(orgSlug, status),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 15_000,
  });
}

export function useStockCount(orgSlug: string, id: string | null) {
  return useQuery({
    queryKey: [KEY, orgSlug, 'detail', id],
    queryFn: () => stockCountsApi.get(orgSlug, id as string),
    enabled: !!orgSlug && !!id,
  });
}

export function useCreateStockCount(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStockCountInput) => stockCountsApi.create(orgSlug, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, orgSlug] }),
  });
}

export function useUpsertCountLine(orgSlug: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertLineInput) => stockCountsApi.upsertLine(orgSlug, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, orgSlug, 'detail', id] }),
  });
}

export function useSubmitStockCount(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => stockCountsApi.submit(orgSlug, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, orgSlug] }),
  });
}

export function useApproveStockCount(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => stockCountsApi.approve(orgSlug, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, orgSlug] });
      qc.invalidateQueries({ queryKey: ['stock', orgSlug] });
    },
  });
}

export function useCancelStockCount(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => stockCountsApi.cancel(orgSlug, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, orgSlug] }),
  });
}
