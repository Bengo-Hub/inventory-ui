'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemsApi, type CreateItemInput, type UpdateItemInput, type PaginatedItems } from '@/lib/api/items';

const ITEMS_KEY = 'items';

const EMPTY_PAGE: PaginatedItems = { data: [], total: 0, page: 1, limit: 20, hasMore: false };

export function useItems(orgSlug: string, params?: { type?: string; status?: string; search?: string; page?: number; limit?: number; unit_id?: string; category_id?: string; use_case?: string }) {
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
