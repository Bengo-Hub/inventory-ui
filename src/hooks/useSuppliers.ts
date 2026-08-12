'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { suppliersApi, type CreateSupplierInput, type UpdateSupplierInput, type SupplierListParams, type PaginatedSuppliers } from '@/lib/api/suppliers';
import type { SelectOption } from '@/components/inventory/CreatableSelect';

const SUPPLIERS_KEY = 'suppliers';

const EMPTY_SUPPLIERS: PaginatedSuppliers = { data: [], total: 0, page: 1, limit: 20, hasMore: false };

export function useSuppliers(orgSlug: string, params?: SupplierListParams) {
  return useQuery<PaginatedSuppliers>({
    queryKey: [SUPPLIERS_KEY, orgSlug, params],
    queryFn: () => suppliersApi.list(orgSlug, params),
    enabled: !!orgSlug,
    placeholderData: EMPTY_SUPPLIERS,
    staleTime: 60_000,
  });
}

/**
 * Stable `onRemoteSearch` callback for any `CreatableSelect` picking a supplier
 * (purchase orders, contracts, requisitions, preferred-supplier on the item form)
 * — GET /inventory/suppliers?search=… backed by the SAME endpoint `useSuppliers`
 * prefetches page 1 of, so a supplier past that first page (e.g. alphabetically
 * beyond the default 20-row limit) is still found once typed.
 */
export function useSupplierSearch(orgSlug: string): (query: string) => Promise<SelectOption[]> {
  return useCallback(
    async (query: string) => {
      const res = await suppliersApi.list(orgSlug, { search: query, limit: 20 });
      return res.data.map((s) => ({ id: s.id, name: s.name, hint: s.contact_person || s.phone || undefined }));
    },
    [orgSlug],
  );
}

export function useSupplier(orgSlug: string, id: string) {
  return useQuery({
    queryKey: [SUPPLIERS_KEY, orgSlug, id],
    queryFn: () => suppliersApi.get(orgSlug, id),
    enabled: !!orgSlug && !!id,
  });
}

export function useCreateSupplier(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSupplierInput) => suppliersApi.create(orgSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_KEY, orgSlug] });
    },
  });
}

export function useUpdateSupplier(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierInput }) =>
      suppliersApi.update(orgSlug, id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_KEY, orgSlug] });
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_KEY, orgSlug, id] });
    },
  });
}

export function useDeleteSupplier(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => suppliersApi.delete(orgSlug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SUPPLIERS_KEY, orgSlug] });
    },
  });
}
