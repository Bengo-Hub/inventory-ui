'use client';

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  purchaseReturnsApi, type CreatePurchaseReturnInput, type PaginatedReturns, type ReceiveServiceInput,
  type ReturnListParams, type ServiceSummary, type ServiceSummaryParams,
} from '@/lib/api/purchase-returns';
import { invalidateBulkStockQueries } from '@/hooks/useStock';

const KEY = 'purchase-returns';
const SUMMARY_KEY = 'purchase-returns-service-summary';
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

/** Open repair orders: units and cost still away, overdue figures, busiest providers. */
export function useServiceSummary(org: string, params?: ServiceSummaryParams) {
  return useQuery<ServiceSummary>({
    queryKey: [SUMMARY_KEY, org, params],
    queryFn: () => purchaseReturnsApi.serviceSummary(org, params),
    enabled: !!org,
    staleTime: 60_000,
  });
}

// An approval or a receive moves stock and changes the repair figures: refresh the list, the
// summary, balances and adjustments, and the item stock history.
function invalidateAfterStockMove(qc: QueryClient, org: string) {
  qc.invalidateQueries({ queryKey: [KEY, org] });
  qc.invalidateQueries({ queryKey: [SUMMARY_KEY, org] });
  invalidateBulkStockQueries(qc, org);
  qc.invalidateQueries({ queryKey: ['stock-history', org] });
}

export function useCreatePurchaseReturn(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePurchaseReturnInput) => purchaseReturnsApi.create(org, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, org] });
      qc.invalidateQueries({ queryKey: [SUMMARY_KEY, org] });
    },
  });
}

export function useApprovePurchaseReturn(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseReturnsApi.approve(org, id),
    onSuccess: () => invalidateAfterStockMove(qc, org),
  });
}

/** Receive repaired goods back from a service provider (and write off the unrepairable units). */
export function useReceiveServiceReturn(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ReceiveServiceInput }) => purchaseReturnsApi.receive(org, id, data),
    onSuccess: () => invalidateAfterStockMove(qc, org),
  });
}
