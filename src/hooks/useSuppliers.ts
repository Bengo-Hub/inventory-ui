'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { suppliersApi, type CreateSupplierInput, type UpdateSupplierInput, type SupplierListParams } from '@/lib/api/suppliers';

const SUPPLIERS_KEY = 'suppliers';

export function useSuppliers(orgSlug: string, params?: SupplierListParams) {
  return useQuery({
    queryKey: [SUPPLIERS_KEY, orgSlug, params],
    queryFn: () => suppliersApi.list(orgSlug, params),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 60_000,
  });
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
