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
  notes?: string;
  created_at: string;
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
};
