'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi, type CreatePOInput, type POListParams, type PaginatedPOs } from '@/lib/api/purchase-orders';

const PO_KEY = 'purchase-orders';
const EMPTY: PaginatedPOs = { data: [], total: 0, page: 1, limit: 20, hasMore: false };

export function usePurchaseOrders(orgSlug: string, params?: POListParams) {
  return useQuery<PaginatedPOs>({
    queryKey: [PO_KEY, orgSlug, params],
    queryFn: ({ signal }) => purchaseOrdersApi.list(orgSlug, params, signal),
    enabled: !!orgSlug,
    // Keep the previous page while a new search loads; empty only on the first load.
    placeholderData: (previous) => previous ?? EMPTY,
    staleTime: 30_000,
  });
}

export function usePurchaseOrder(orgSlug: string, id: string) {
  return useQuery({
    queryKey: [PO_KEY, orgSlug, id],
    queryFn: () => purchaseOrdersApi.get(orgSlug, id),
    enabled: !!orgSlug && !!id,
  });
}

export function useCreatePurchaseOrder(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePOInput) => purchaseOrdersApi.create(orgSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PO_KEY, orgSlug] });
    },
  });
}

export function useAmendPurchaseOrder(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreatePOInput }) => purchaseOrdersApi.amend(orgSlug, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [PO_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [PO_KEY, orgSlug, id] });
    },
  });
}

export function useReceivePurchaseOrder(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items?: { item_id: string; received_qty: number }[] }) =>
      purchaseOrdersApi.receive(orgSlug, id, items),
    // Settled, not just success: a 409 "awaiting approval" still opened (or found) a goods
    // receipt, and the drawer must refetch to show it instead of offering Mark Received again.
    onSettled: (_, __, { id }) => {
      queryClient.invalidateQueries({ queryKey: [PO_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [PO_KEY, orgSlug, id] });
      queryClient.invalidateQueries({ queryKey: ['stock', orgSlug] });
      queryClient.invalidateQueries({ queryKey: ['goods-receipts', orgSlug] });
      queryClient.invalidateQueries({ queryKey: ['approval-requests', orgSlug] });
    },
  });
}

export function useSendPurchaseOrder(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, overrideBudget }: { id: string; overrideBudget?: boolean }) =>
      purchaseOrdersApi.send(orgSlug, id, overrideBudget),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [PO_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [PO_KEY, orgSlug, id] });
    },
  });
}

/** Permanently deletes a purchase order with its draft receipts and approvals (platform owners only). */
export function useHardDeletePurchaseOrder(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.hardDelete(orgSlug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PO_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: ['approval-requests', orgSlug] });
      queryClient.invalidateQueries({ queryKey: ['goods-receipts', orgSlug] });
    },
  });
}

export function useCancelPurchaseOrder(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => purchaseOrdersApi.cancel(orgSlug, id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [PO_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [PO_KEY, orgSlug, id] });
    },
  });
}
