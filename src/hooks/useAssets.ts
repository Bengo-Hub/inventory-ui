'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assetsApi, type AssetCategory, type AssetListParams, type CreateAssetInput,
  type CreateCategoryInput, type PaginatedAssets, type UpdateAssetInput,
} from '@/lib/api/assets';

const KEY = 'assets';
const CAT_KEY = 'asset-categories';
const EMPTY: PaginatedAssets = { data: [], total: 0, page: 1, limit: 20, hasMore: false };

export function useAssets(org: string, params?: AssetListParams) {
  return useQuery<PaginatedAssets>({
    queryKey: [KEY, org, params],
    queryFn: () => assetsApi.list(org, params),
    enabled: !!org,
    placeholderData: EMPTY,
    staleTime: 60_000,
  });
}

export function useAssetCategories(org: string) {
  return useQuery<AssetCategory[]>({
    queryKey: [CAT_KEY, org],
    queryFn: () => assetsApi.listCategories(org),
    enabled: !!org,
    staleTime: 300_000,
  });
}

export function useCreateAsset(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateAssetInput) => assetsApi.create(org, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useUpdateAsset(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateAssetInput }) => assetsApi.update(org, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useDeleteAsset(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assetsApi.remove(org, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useRunDepreciation(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assetsApi.runDepreciation(org, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, org] }),
  });
}

export function useCreateAssetCategory(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCategoryInput) => assetsApi.createCategory(org, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CAT_KEY, org] }),
  });
}
