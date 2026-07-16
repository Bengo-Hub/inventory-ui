'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  warrantiesApi, type Warranty, type WarrantyListParams, type WarrantyWriteInput,
} from '@/lib/api/warranties';

const KEY = 'warranties';

export function useWarranties(org: string, params?: WarrantyListParams) {
  return useQuery<Warranty[]>({
    queryKey: [KEY, org, params],
    queryFn: () => warrantiesApi.list(org, params),
    enabled: !!org,
    placeholderData: [],
    staleTime: 60_000,
  });
}

export function useCreateWarranty(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WarrantyWriteInput) => warrantiesApi.create(org, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useUpdateWarranty(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: WarrantyWriteInput }) => warrantiesApi.update(org, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useClaimWarranty(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => warrantiesApi.claim(org, id, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useVoidWarranty(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notes }: { id: string; notes?: string }) => warrantiesApi.void(org, id, notes),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useDeleteWarranty(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => warrantiesApi.remove(org, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}
