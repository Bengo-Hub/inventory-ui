'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stockApi, type CreateAdjustmentInput, type CreateBreakdownInput, type StockListParams, type AdjustmentListParams, type StockHistoryParams, type BulkAdjustStockInput, type SetItemOutletMembershipInput } from '@/lib/api/stock';
import { registerPendingJob, labelForJobType } from '@/lib/bulk-job-alert-queue';

const STOCK_KEY = 'stock';
const ADJ_KEY = 'adjustments';
const SUMMARY_KEY = 'inventory-summary';

export function useStock(orgSlug: string, params?: StockListParams, enabled = true) {
  return useQuery({
    queryKey: [STOCK_KEY, orgSlug, params],
    queryFn: () => stockApi.list(orgSlug, params),
    enabled: !!orgSlug && enabled,
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

export function useCreateBreakdown(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBreakdownInput) => stockApi.createBreakdown(orgSlug, data),
    onSuccess: () => {
      // A breakdown touches both parent + child balances and writes two adjustments,
      // so invalidate the same queries the adjustment mutation does.
      queryClient.invalidateQueries({ queryKey: [STOCK_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [ADJ_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [SUMMARY_KEY, orgSlug] });
    },
  });
}

/** Invalidates every query a bulk stock job (relocation/membership, bulk-adjust) can affect —
 *  called once up front when a job is QUEUED (so a re-render doesn't show stale loading state
 *  forever) and again by the org-shell notification listener when it COMPLETES (so the eventual
 *  real result replaces whatever the pre-completion refetch happened to catch mid-flight). */
export function invalidateBulkStockQueries(queryClient: ReturnType<typeof useQueryClient>, orgSlug: string) {
  queryClient.invalidateQueries({ queryKey: [STOCK_KEY, orgSlug] });
  queryClient.invalidateQueries({ queryKey: [ADJ_KEY, orgSlug] });
  queryClient.invalidateQueries({ queryKey: [SUMMARY_KEY, orgSlug] });
  queryClient.invalidateQueries({ queryKey: ['items', orgSlug] });
}

// The checkbox catalog-movement UX (see OutletMembershipDialog.tsx) — queues a background job
// and returns immediately; the actual balance changes land once the job completes (see
// invalidateBulkStockQueries / the org-shell bulk_job.completed listener), not on this response.
export function useSetItemOutletMembership(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SetItemOutletMembershipInput) => stockApi.setMembership(orgSlug, data),
    onSuccess: (job) => {
      registerPendingJob(job.job_id, labelForJobType('item_relocation'));
      invalidateBulkStockQueries(queryClient, orgSlug);
    },
  });
}

// Bulk stock adjustment — one shared warehouse/reason, a per-item delta. Reused by
// BulkAdjustStockDialog across the Products, Stock Levels, and Adjustments pages (see that
// component for the single centralized UI all three open). Queues a background job; see
// useSetItemOutletMembership's note on when the real result actually lands.
export function useBulkAdjustStock(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkAdjustStockInput) => stockApi.bulkAdjust(orgSlug, data),
    onSuccess: (job) => {
      registerPendingJob(job.job_id, labelForJobType('bulk_stock_adjust'));
      invalidateBulkStockQueries(queryClient, orgSlug);
    },
  });
}

// Polling fallback for a bulk job's status when the notification WebSocket isn't connected —
// see org-shell.tsx's NotificationListener for the primary (push-based) completion path.
export function useBulkJobStatus(orgSlug: string, jobId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ['bulk-job', orgSlug, jobId],
    queryFn: () => stockApi.getBulkJob(orgSlug, jobId as string),
    enabled: !!orgSlug && !!jobId && enabled,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === 'completed' || status === 'failed' ? false : 2_000;
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

// Product stock history — the per-item ledger modal (summary cards + movements).
export function useItemStockHistory(orgSlug: string, sku: string, params?: StockHistoryParams) {
  return useQuery({
    queryKey: ['stock-history', orgSlug, sku, params],
    queryFn: () => stockApi.itemHistory(orgSlug, sku, params),
    enabled: !!orgSlug && !!sku,
    staleTime: 30_000,
  });
}
