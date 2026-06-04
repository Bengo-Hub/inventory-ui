'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { goodsReceiptsApi, type CreateGRNInput, type GRNListParams, type PaginatedGRNs } from '@/lib/api/goods-receipts';

const KEY = 'goods-receipts';
const EMPTY: PaginatedGRNs = { data: [], total: 0, page: 1, limit: 20, hasMore: false };

export function useGoodsReceipts(org: string, params?: GRNListParams) {
  return useQuery<PaginatedGRNs>({
    queryKey: [KEY, org, params],
    queryFn: () => goodsReceiptsApi.list(org, params),
    enabled: !!org,
    placeholderData: EMPTY,
    staleTime: 30_000,
  });
}

export function useGoodsReceipt(org: string, id: string) {
  return useQuery({
    queryKey: [KEY, org, id],
    queryFn: () => goodsReceiptsApi.get(org, id),
    enabled: !!org && !!id,
  });
}

export function useCreateGoodsReceipt(org: string, poId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGRNInput) => goodsReceiptsApi.create(org, poId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function usePostGoodsReceipt(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => goodsReceiptsApi.post(org, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY, org] });
      qc.invalidateQueries({ queryKey: ['purchase-orders', org] });
    },
  });
}
