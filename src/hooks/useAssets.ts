'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  assetsApi, type AssetCategory, type AssetListParams, type CreateAssetInput,
  type CreateCategoryInput, type PaginatedAssets, type UpdateAssetInput,
  type UpdateCategoryInput, type MaintenanceInput, type TransferInput, type DisposalInput,
  type InsuranceInput, type AuditInput, type ReservationInput,
} from '@/lib/api/assets';

const KEY = 'assets';
const CAT_KEY = 'asset-categories';
const MAINT_KEY = 'asset-maintenance';
const TRF_KEY = 'asset-transfers';
const DISP_KEY = 'asset-disposals';
const INS_KEY = 'asset-insurance';
const AUDIT_KEY = 'asset-audits';
const RESV_KEY = 'asset-reservations';
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

export function useAsset(org: string, id: string) {
  return useQuery({ queryKey: [KEY, org, id], queryFn: () => assetsApi.get(org, id), enabled: !!org && !!id });
}

export function useAssetDashboard(org: string) {
  return useQuery({ queryKey: [KEY, org, 'dashboard'], queryFn: () => assetsApi.dashboard(org), enabled: !!org, staleTime: 120_000 });
}

export function useUpdateAssetCategory(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryInput }) => assetsApi.updateCategory(org, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CAT_KEY, org] }),
  });
}

export function useDeleteAssetCategory(org: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => assetsApi.deleteCategory(org, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [CAT_KEY, org] }),
  });
}

// ── Lifecycle ops: list + create (+ complete where the workflow has one) ──
const invalidateAsset = (qc: ReturnType<typeof useQueryClient>, org: string) => qc.invalidateQueries({ queryKey: [KEY, org] });

export function useAssetMaintenance(org: string, assetId: string) {
  return useQuery({ queryKey: [MAINT_KEY, org, assetId], queryFn: () => assetsApi.listMaintenance(org, assetId), enabled: !!org && !!assetId });
}
export function useCreateMaintenance(org: string, assetId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: MaintenanceInput) => assetsApi.createMaintenance(org, assetId, data), onSuccess: () => qc.invalidateQueries({ queryKey: [MAINT_KEY, org, assetId] }) });
}
export function useCompleteMaintenance(org: string, assetId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (recId: string) => assetsApi.completeMaintenance(org, recId), onSuccess: () => { qc.invalidateQueries({ queryKey: [MAINT_KEY, org, assetId] }); invalidateAsset(qc, org); } });
}

export function useAssetTransfers(org: string, assetId: string) {
  return useQuery({ queryKey: [TRF_KEY, org, assetId], queryFn: () => assetsApi.listTransfers(org, assetId), enabled: !!org && !!assetId });
}
export function useCreateTransfer(org: string, assetId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: TransferInput) => assetsApi.createTransfer(org, assetId, data), onSuccess: () => qc.invalidateQueries({ queryKey: [TRF_KEY, org, assetId] }) });
}
export function useApproveTransfer(org: string, assetId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (recId: string) => assetsApi.approveTransfer(org, recId), onSuccess: () => qc.invalidateQueries({ queryKey: [TRF_KEY, org, assetId] }) });
}
export function useCompleteTransfer(org: string, assetId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (recId: string) => assetsApi.completeTransfer(org, recId), onSuccess: () => { qc.invalidateQueries({ queryKey: [TRF_KEY, org, assetId] }); invalidateAsset(qc, org); } });
}

export function useAssetDisposals(org: string, assetId: string) {
  return useQuery({ queryKey: [DISP_KEY, org, assetId], queryFn: () => assetsApi.listDisposals(org, assetId), enabled: !!org && !!assetId });
}
export function useCreateDisposal(org: string, assetId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: DisposalInput) => assetsApi.createDisposal(org, assetId, data), onSuccess: () => qc.invalidateQueries({ queryKey: [DISP_KEY, org, assetId] }) });
}
export function useCompleteDisposal(org: string, assetId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (recId: string) => assetsApi.completeDisposal(org, recId), onSuccess: () => { qc.invalidateQueries({ queryKey: [DISP_KEY, org, assetId] }); invalidateAsset(qc, org); } });
}

export function useAssetInsurance(org: string, assetId: string) {
  return useQuery({ queryKey: [INS_KEY, org, assetId], queryFn: () => assetsApi.listInsurance(org, assetId), enabled: !!org && !!assetId });
}
export function useCreateInsurance(org: string, assetId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: InsuranceInput) => assetsApi.createInsurance(org, assetId, data), onSuccess: () => qc.invalidateQueries({ queryKey: [INS_KEY, org, assetId] }) });
}

export function useAssetAudits(org: string, assetId: string) {
  return useQuery({ queryKey: [AUDIT_KEY, org, assetId], queryFn: () => assetsApi.listAudits(org, assetId), enabled: !!org && !!assetId });
}
export function useCreateAudit(org: string, assetId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: AuditInput) => assetsApi.createAudit(org, assetId, data), onSuccess: () => qc.invalidateQueries({ queryKey: [AUDIT_KEY, org, assetId] }) });
}
export function useCompleteAudit(org: string, assetId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (recId: string) => assetsApi.completeAudit(org, recId), onSuccess: () => qc.invalidateQueries({ queryKey: [AUDIT_KEY, org, assetId] }) });
}

export function useAssetReservations(org: string, assetId: string) {
  return useQuery({ queryKey: [RESV_KEY, org, assetId], queryFn: () => assetsApi.listReservations(org, assetId), enabled: !!org && !!assetId });
}
export function useCreateReservation(org: string, assetId: string) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: ReservationInput) => assetsApi.createReservation(org, assetId, data), onSuccess: () => qc.invalidateQueries({ queryKey: [RESV_KEY, org, assetId] }) });
}
