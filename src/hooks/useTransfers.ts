'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { transfersApi, type CreateTransferInput, type UpdateTransferInput, type TransferListParams, type TransferSummary } from '@/lib/api/transfers';

const TRANSFERS_KEY = 'transfers';

export function useTransfers(orgSlug: string, params?: TransferListParams) {
  return useQuery<TransferSummary[]>({
    queryKey: [TRANSFERS_KEY, orgSlug, params],
    queryFn: () => transfersApi.list(orgSlug, params),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 30_000,
  });
}

export function useTransfer(orgSlug: string, id: string) {
  return useQuery({
    queryKey: [TRANSFERS_KEY, orgSlug, id],
    queryFn: () => transfersApi.get(orgSlug, id),
    enabled: !!orgSlug && !!id,
  });
}

export function useCreateTransfer(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTransferInput) => transfersApi.create(orgSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSFERS_KEY, orgSlug] });
    },
  });
}

export function useUpdateTransfer(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransferInput }) => transfersApi.update(orgSlug, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [TRANSFERS_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [TRANSFERS_KEY, orgSlug, id] });
    },
  });
}

export function useShipTransfer(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transfersApi.ship(orgSlug, id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [TRANSFERS_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [TRANSFERS_KEY, orgSlug, id] });
    },
  });
}

export function useReceiveTransfer(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    // items is optional — omit it entirely for "everything arrived as shipped" (every line
    // credits its full drafted quantity, same as before this override existed).
    mutationFn: ({ id, items }: { id: string; items?: { item_id: string; line_id: string; received_qty: number; variance_reason?: string }[] }) =>
      transfersApi.receive(orgSlug, id, items),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [TRANSFERS_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [TRANSFERS_KEY, orgSlug, id] });
      queryClient.invalidateQueries({ queryKey: ['stock', orgSlug] });
    },
  });
}

export function useCancelTransfer(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => transfersApi.cancel(orgSlug, id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [TRANSFERS_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [TRANSFERS_KEY, orgSlug, id] });
    },
  });
}
