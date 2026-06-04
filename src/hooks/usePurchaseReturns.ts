'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  purchaseReturnsApi, type CreatePurchaseReturnInput, type PaginatedReturns, type ReturnListParams,
} from '@/lib/api/purchase-returns';

const KEY = 'purchase-returns';
const EMPTY: PaginatedReturns = { data: [], total: 0, page: 1, limit: 20, hasMore: false };

export function usePurchaseReturns(org: string, params?: ReturnListParams) {
  return useQuery<PaginatedReturns>({
    queryKey: [KEY, org, params],
    queryFn: () => purchaseReturnsApi.list(org, params),
    enabled: !!org,
    placeholderData: EMPTY,
    staleTime: 60_000,
  });
}

export function useCreatePurchaseReturn(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePurchaseReturnInput) => purchaseReturnsApi.create(org, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useApprovePurchaseReturn(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseReturnsApi.approve(org, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}
