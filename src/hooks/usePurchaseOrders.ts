'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { purchaseOrdersApi, type CreatePOInput, type POListParams } from '@/lib/api/purchase-orders';

const PO_KEY = 'purchase-orders';

export function usePurchaseOrders(orgSlug: string, params?: POListParams) {
  return useQuery({
    queryKey: [PO_KEY, orgSlug, params],
    queryFn: () => purchaseOrdersApi.list(orgSlug, params),
    enabled: !!orgSlug,
    placeholderData: [],
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

export function useReceivePurchaseOrder(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, items }: { id: string; items?: { item_id: string; received_qty: number }[] }) =>
      purchaseOrdersApi.receive(orgSlug, id, items),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [PO_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [PO_KEY, orgSlug, id] });
      queryClient.invalidateQueries({ queryKey: ['stock', orgSlug] });
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
