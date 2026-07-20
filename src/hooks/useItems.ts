'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  itemsApi,
  type BulkStatusAction,
  type CreateItemInput,
  type ListItemsParams,
  type UpdateItemInput,
  type PaginatedItems,
} from '@/lib/api/items';

const ITEMS_KEY = 'items';

const EMPTY_PAGE: PaginatedItems = { data: [], total: 0, page: 1, limit: 20, hasMore: false };

export function useItems(orgSlug: string, params?: ListItemsParams) {
  return useQuery({
    queryKey: [ITEMS_KEY, orgSlug, params],
    queryFn: () => itemsApi.list(orgSlug, params),
    enabled: !!orgSlug,
    placeholderData: EMPTY_PAGE,
    staleTime: 60_000,
  });
}

export function useItem(orgSlug: string, sku: string) {
  return useQuery({
    queryKey: [ITEMS_KEY, orgSlug, sku],
    queryFn: () => itemsApi.get(orgSlug, sku),
    enabled: !!orgSlug && !!sku,
  });
}

export function useCreateItem(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateItemInput) => itemsApi.create(orgSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ITEMS_KEY, orgSlug] });
    },
  });
}

export function useUpdateItem(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sku, data }: { sku: string; data: UpdateItemInput }) =>
      itemsApi.update(orgSlug, sku, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ITEMS_KEY, orgSlug] });
    },
  });
}

export function useDeleteItem(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sku: string) => itemsApi.delete(orgSlug, sku),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ITEMS_KEY, orgSlug] });
    },
  });
}

// Bulk multi-select actions (DataTable) — idempotent server-side; skipped ids come
// back with reasons for the toast summary.
export function useBulkDeleteItems(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => itemsApi.bulkDelete(orgSlug, ids),
    onSuccess: () => invalidateItemViews(queryClient, orgSlug),
  });
}

export function useBulkItemStatus(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: BulkStatusAction }) =>
      itemsApi.bulkStatus(orgSlug, ids, action),
    onSuccess: () => invalidateItemViews(queryClient, orgSlug),
  });
}

// invalidateItemViews refreshes every surface an EOL transition affects: item lists
// (including the End-of-Life tab) and the stock-levels view the item vanishes from.
function invalidateItemViews(queryClient: ReturnType<typeof useQueryClient>, orgSlug: string) {
  queryClient.invalidateQueries({ queryKey: [ITEMS_KEY, orgSlug] });
  queryClient.invalidateQueries({ queryKey: ['stock', orgSlug] });
}

export function useMarkItemEOL(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sku: string) => itemsApi.markEOL(orgSlug, sku),
    onSuccess: () => invalidateItemViews(queryClient, orgSlug),
  });
}

export function useRestoreItemEOL(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sku: string) => itemsApi.restoreEOL(orgSlug, sku),
    onSuccess: () => invalidateItemViews(queryClient, orgSlug),
  });
}
