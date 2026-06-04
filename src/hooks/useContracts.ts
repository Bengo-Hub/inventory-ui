'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  contractsApi, type ContractListParams, type CreateContractInput, type PaginatedContracts, type UpdateContractInput,
} from '@/lib/api/contracts';

const KEY = 'contracts';
const EMPTY: PaginatedContracts = { data: [], total: 0, page: 1, limit: 20, hasMore: false };

export function useContracts(org: string, params?: ContractListParams) {
  return useQuery<PaginatedContracts>({
    queryKey: [KEY, org, params],
    queryFn: () => contractsApi.list(org, params),
    enabled: !!org,
    placeholderData: EMPTY,
    staleTime: 60_000,
  });
}

export function useCreateContract(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateContractInput) => contractsApi.create(org, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useUpdateContract(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContractInput }) => contractsApi.update(org, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useActivateContract(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contractsApi.activate(org, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useTerminateContract(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => contractsApi.terminate(org, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}
