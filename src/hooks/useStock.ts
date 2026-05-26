'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stockApi, type CreateAdjustmentInput, type StockListParams, type AdjustmentListParams } from '@/lib/api/stock';

const STOCK_KEY = 'stock';
const ADJ_KEY = 'adjustments';
const SUMMARY_KEY = 'inventory-summary';

export function useStock(orgSlug: string, params?: StockListParams) {
  return useQuery({
    queryKey: [STOCK_KEY, orgSlug, params],
    queryFn: () => stockApi.list(orgSlug, params),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 30_000,
  });
}

export function useAdjustments(orgSlug: string, params?: AdjustmentListParams) {
  return useQuery({
    queryKey: [ADJ_KEY, orgSlug, params],
    queryFn: () => stockApi.listAdjustments(orgSlug, params),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 30_000,
  });
}

export function useCreateAdjustment(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAdjustmentInput) => stockApi.createAdjustment(orgSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [STOCK_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [ADJ_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [SUMMARY_KEY, orgSlug] });
    },
  });
}

export function useInventorySummary(orgSlug: string) {
  return useQuery({
    queryKey: [SUMMARY_KEY, orgSlug],
    queryFn: () => stockApi.getSummary(orgSlug),
    enabled: !!orgSlug,
    staleTime: 60_000,
  });
}

export function useBulkAvailability(orgSlug: string, skus: string[]) {
  return useQuery({
    queryKey: ['availability', orgSlug, skus],
    queryFn: () => stockApi.bulkAvailability(orgSlug, skus),
    enabled: !!orgSlug && skus.length > 0,
    staleTime: 15_000,
  });
}
