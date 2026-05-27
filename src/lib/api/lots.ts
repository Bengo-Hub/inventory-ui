import { apiClient } from './client';

export interface Lot {
  id: string;
  lot_number: string;
  item_id: string;
  item_name?: string;
  item_sku?: string;
  warehouse_id: string;
  warehouse_name?: string;
  quantity: number;
  expiry_date?: string;
  manufacture_date?: string;
  cost_per_unit?: number;
  supplier_reference?: string;
  notes?: string;
  status?: 'active' | 'expired' | 'recalled' | 'depleted';
  created_at: string;
}

export interface CreateLotInput {
  item_id: string;
  warehouse_id: string;
  lot_number: string;
  quantity: number;
  expiry_date?: string;
  manufacture_date?: string;
  cost_per_unit?: number;
  supplier_reference?: string;
  notes?: string;
}

export interface UpdateLotInput {
  quantity?: number;
  expiry_date?: string;
  manufacture_date?: string;
  cost_per_unit?: number;
  supplier_reference?: string;
  notes?: string;
  status?: 'active' | 'expired' | 'recalled' | 'depleted';
}

export interface LotListParams {
  warehouse_id?: string;
  item_id?: string;
  expiring_before?: string;
  page?: number;
  limit?: number;
}

export const lotsApi = {
  list: (orgSlug: string, params?: LotListParams) =>
    apiClient.get<Lot[]>(`/api/v1/${orgSlug}/inventory/lots`, params),

  create: (orgSlug: string, data: CreateLotInput) =>
    apiClient.post<Lot>(`/api/v1/${orgSlug}/inventory/lots`, data),

  update: (orgSlug: string, id: string, data: UpdateLotInput) =>
    apiClient.put<Lot>(`/api/v1/${orgSlug}/inventory/lots/${id}`, data),

  delete: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/lots/${id}`),
};
