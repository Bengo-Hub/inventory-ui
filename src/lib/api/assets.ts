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

const base = (org: string) => `/api/v1/${org}/inventory/assets`;
const catBase = (org: string) => `/api/v1/${org}/inventory/asset-categories`;

export const assetsApi = {
  list: (org: string, params?: AssetListParams): Promise<PaginatedAssets> => apiClient.get<PaginatedAssets>(base(org), params),
  get: (org: string, id: string) => apiClient.get<Asset>(`${base(org)}/${id}`),
  create: (org: string, data: CreateAssetInput) => apiClient.post<Asset>(base(org), data),
  update: (org: string, id: string, data: UpdateAssetInput) => apiClient.put<Asset>(`${base(org)}/${id}`, data),
  remove: (org: string, id: string) => apiClient.delete(`${base(org)}/${id}`),
  runDepreciation: (org: string, id: string) => apiClient.post<Asset>(`${base(org)}/${id}/depreciation-run`, {}),

  listCategories: (org: string): Promise<AssetCategory[]> => apiClient.get<AssetCategory[]>(catBase(org)),
  createCategory: (org: string, data: CreateCategoryInput) => apiClient.post<AssetCategory>(catBase(org), data),
};
