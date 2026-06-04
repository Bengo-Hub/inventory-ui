import { apiClient } from './client';

export type AssetStatus = 'active' | 'inactive' | 'maintenance' | 'disposed' | 'lost' | 'damaged' | 'retired';

export interface AssetCategory {
  id: string;
  name: string;
  description?: string;
  parent_id?: string | null;
  depreciation_rate: number;
  useful_life_years: number;
  is_active: boolean;
}

export interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  description?: string;
  category_id?: string | null;
  serial_number?: string;
  model?: string;
  manufacturer?: string;
  barcode?: string;
  purchase_date?: string | null;
  purchase_cost: number;
  salvage_value: number;
  depreciation_rate: number;
  depreciation_method?: string;
  current_value?: number;
  accumulated_depreciation?: number;
  location?: string;
  outlet_id?: string | null;
  custodian_id?: string | null;
  condition?: string;
  status: AssetStatus;
  notes?: string;
  created_at: string;
}

export interface CreateAssetInput {
  asset_tag: string;
  name: string;
  description?: string;
  category_id?: string | null;
  serial_number?: string;
  model?: string;
  manufacturer?: string;
  barcode?: string;
  purchase_date?: string | null;
  purchase_cost?: number;
  salvage_value?: number;
  depreciation_rate?: number;
  depreciation_method?: string;
  location?: string;
  condition?: string;
  notes?: string;
}

export type UpdateAssetInput = Partial<CreateAssetInput>;

export interface AssetListParams { status?: AssetStatus; category_id?: string; search?: string; page?: number; limit?: number; }
export interface PaginatedAssets { data: Asset[]; total: number; page: number; limit: number; hasMore: boolean; }

export interface CreateCategoryInput {
  name: string;
  description?: string;
  parent_id?: string | null;
  depreciation_rate?: number;
  useful_life_years?: number;
}
export type UpdateCategoryInput = Partial<CreateCategoryInput>;

// ── Lifecycle operation records (returned as raw rows by the API) ──
export interface AssetMaintenanceRec { id: string; maintenance_type?: string; scheduled_date?: string; completed_date?: string | null; performed_by?: string; cost?: number; description?: string; priority?: string; status?: string; next_maintenance_date?: string | null; created_at?: string; }
export interface AssetTransferRec { id: string; from_location?: string; to_location?: string; to_user?: string | null; reason?: string; transfer_date?: string; status?: string; }
export interface AssetDisposalRec { id: string; disposal_method?: string; disposal_value?: number; reason?: string; disposal_date?: string; status?: string; }
export interface AssetInsuranceRec { id: string; policy_number?: string; provider?: string; policy_type?: string; coverage_amount?: number; premium_amount?: number; start_date?: string; end_date?: string; deductible?: number; is_active?: boolean; }
export interface AssetAuditRec { id: string; audit_date?: string; auditor_id?: string | null; status?: string; location_verified?: string; condition_verified?: string; discrepancies?: string; recommendations?: string; next_audit_date?: string | null; }
export interface AssetReservationRec { id: string; reserved_by?: string; start_date?: string; end_date?: string; purpose?: string; status?: string; }

export interface MaintenanceInput { maintenance_type?: string; scheduled_date?: string; performed_by?: string; cost?: number; description?: string; priority?: string; next_maintenance_date?: string; }
export interface TransferInput { from_location?: string; to_location?: string; to_user?: string; reason?: string; }
export interface DisposalInput { disposal_method?: string; disposal_value?: number; reason?: string; }
export interface InsuranceInput { policy_number: string; provider?: string; policy_type?: string; coverage_amount?: number; premium_amount?: number; start_date?: string; end_date?: string; deductible?: number; }
export interface AuditInput { auditor_id?: string; location_verified?: string; condition_verified?: string; discrepancies?: string; recommendations?: string; }
export interface ReservationInput { reserved_by: string; start_date?: string; end_date?: string; purpose?: string; }

export interface AssetDashboard {
  total_assets: number;
  total_purchase_cost: number;
  total_current_value: number;
  total_accumulated_depreciation: number;
  assets_by_status: Record<string, number>;
}

const base = (org: string) => `/api/v1/${org}/inventory/assets`;
const catBase = (org: string) => `/api/v1/${org}/inventory/asset-categories`;
const opBase = (org: string) => `/api/v1/${org}/inventory`;

export const assetsApi = {
  list: (org: string, params?: AssetListParams): Promise<PaginatedAssets> => apiClient.get<PaginatedAssets>(base(org), params),
  get: (org: string, id: string) => apiClient.get<Asset>(`${base(org)}/${id}`),
  create: (org: string, data: CreateAssetInput) => apiClient.post<Asset>(base(org), data),
  update: (org: string, id: string, data: UpdateAssetInput) => apiClient.put<Asset>(`${base(org)}/${id}`, data),
  remove: (org: string, id: string) => apiClient.delete(`${base(org)}/${id}`),
  runDepreciation: (org: string, id: string) => apiClient.post<Asset>(`${base(org)}/${id}/depreciation-run`, {}),

  dashboard: (org: string): Promise<AssetDashboard> => apiClient.get<AssetDashboard>(`${opBase(org)}/asset-dashboard`),
  listCategories: (org: string): Promise<AssetCategory[]> => apiClient.get<AssetCategory[]>(catBase(org)),
  createCategory: (org: string, data: CreateCategoryInput) => apiClient.post<AssetCategory>(catBase(org), data),
  updateCategory: (org: string, id: string, data: UpdateCategoryInput) => apiClient.put<AssetCategory>(`${catBase(org)}/${id}`, data),
  deleteCategory: (org: string, id: string) => apiClient.delete(`${catBase(org)}/${id}`),

  // ── Maintenance ──
  listMaintenance: (org: string, assetId: string) => apiClient.get<AssetMaintenanceRec[]>(`${base(org)}/${assetId}/maintenance`),
  createMaintenance: (org: string, assetId: string, data: MaintenanceInput) => apiClient.post<AssetMaintenanceRec>(`${base(org)}/${assetId}/maintenance`, data),
  completeMaintenance: (org: string, recId: string) => apiClient.post<AssetMaintenanceRec>(`${opBase(org)}/asset-maintenance/${recId}/complete`, {}),

  // ── Transfers ──
  listTransfers: (org: string, assetId: string) => apiClient.get<AssetTransferRec[]>(`${base(org)}/${assetId}/transfers`),
  createTransfer: (org: string, assetId: string, data: TransferInput) => apiClient.post<AssetTransferRec>(`${base(org)}/${assetId}/transfers`, data),
  approveTransfer: (org: string, recId: string) => apiClient.post<AssetTransferRec>(`${opBase(org)}/asset-transfers/${recId}/approve`, {}),
  completeTransfer: (org: string, recId: string) => apiClient.post<AssetTransferRec>(`${opBase(org)}/asset-transfers/${recId}/complete`, {}),

  // ── Disposals ──
  listDisposals: (org: string, assetId: string) => apiClient.get<AssetDisposalRec[]>(`${base(org)}/${assetId}/disposals`),
  createDisposal: (org: string, assetId: string, data: DisposalInput) => apiClient.post<AssetDisposalRec>(`${base(org)}/${assetId}/disposals`, data),
  completeDisposal: (org: string, recId: string) => apiClient.post<AssetDisposalRec>(`${opBase(org)}/asset-disposals/${recId}/complete`, {}),

  // ── Insurance ──
  listInsurance: (org: string, assetId: string) => apiClient.get<AssetInsuranceRec[]>(`${base(org)}/${assetId}/insurance`),
  createInsurance: (org: string, assetId: string, data: InsuranceInput) => apiClient.post<AssetInsuranceRec>(`${base(org)}/${assetId}/insurance`, data),

  // ── Audits ──
  listAudits: (org: string, assetId: string) => apiClient.get<AssetAuditRec[]>(`${base(org)}/${assetId}/audits`),
  createAudit: (org: string, assetId: string, data: AuditInput) => apiClient.post<AssetAuditRec>(`${base(org)}/${assetId}/audits`, data),
  completeAudit: (org: string, recId: string) => apiClient.post<AssetAuditRec>(`${opBase(org)}/asset-audits/${recId}/complete`, {}),

  // ── Reservations ──
  listReservations: (org: string, assetId: string) => apiClient.get<AssetReservationRec[]>(`${base(org)}/${assetId}/reservations`),
  createReservation: (org: string, assetId: string, data: ReservationInput) => apiClient.post<AssetReservationRec>(`${base(org)}/${assetId}/reservations`, data),
};
