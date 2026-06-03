'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  requisitionsApi,
  type CreateRequisitionInput,
  type RequisitionListParams,
  type PaginatedRequisitions,
  type ConvertToPOInput,
} from '@/lib/api/requisitions';

const KEY = 'requisitions';
const EMPTY: PaginatedRequisitions = { data: [], total: 0, page: 1, limit: 20, hasMore: false };

export function useRequisitions(org: string, params?: RequisitionListParams) {
  return useQuery<PaginatedRequisitions>({
    queryKey: [KEY, org, params],
    queryFn: () => requisitionsApi.list(org, params),
    enabled: !!org,
    placeholderData: EMPTY,
    staleTime: 60_000,
  });
}

export function useRequisition(org: string, id: string) {
  return useQuery({
    queryKey: [KEY, org, id],
    queryFn: () => requisitionsApi.get(org, id),
    enabled: !!org && !!id,
  });
}

export function useCreateRequisition(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRequisitionInput) => requisitionsApi.create(org, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

function useTransition(org: string, fn: (org: string, id: string) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fn(org, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export const useSubmitRequisition = (org: string) => useTransition(org, requisitionsApi.submit);
export const useReviewRequisition = (org: string) => useTransition(org, requisitionsApi.review);
export const useApproveRequisition = (org: string) => useTransition(org, requisitionsApi.approve);
export const useRejectRequisition = (org: string) => useTransition(org, requisitionsApi.reject);

export function useConvertRequisitionToPO(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ConvertToPOInput }) =>
      requisitionsApi.convertToPO(org, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}
