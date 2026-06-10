import { apiClient } from './client';

export interface StockLevel {
  id: string;
  item_name: string;
  sku: string;
  warehouse_id: string;
  warehouse_name: string;
  available: number;
  reserved: number;
  reorder_point?: number;
  unit?: string;
  unit_id?: string;
  category_id?: string;
  category_name?: string;
  type?: string;
}

export interface StockAdjustment {
  id: string;
  item_id: string;
  item_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  quantity_change: number;
  reason: string;
  reference?: string;
  notes?: string;
  adjusted_at: string;
  created_at: string;
}

export interface CreateAdjustmentInput {
  sku: string;
  adjustment: number;
  reason: string;
  reference?: string;
  notes?: string;
  warehouse_id?: string;
  unit_id?: string;
}

export interface CreateBreakdownInput {
  parent_sku: string;
  child_sku: string;
  parent_quantity: number;
  // Provide conversion_factor OR child_quantity; the backend derives child_quantity
  // from conversion_factor when child_quantity is omitted.
  conversion_factor?: number;
  child_quantity?: number;
  warehouse_id?: string;
  cost_allocated?: number;
  reference?: string;
  notes?: string;
}

export interface StockBreakdown {
  id: string;
  parent_sku: string;
  child_sku: string;
  parent_quantity: number;
  child_quantity: number;
  parent_on_hand: number;
  child_on_hand: number;
  created_at: string;
}

export interface StockListParams {
  warehouse_id?: string;
  search?: string;
  low_stock?: boolean;
  out_of_stock?: boolean;
  category_id?: string;
  type?: string;
}

export interface AdjustmentListParams {
  warehouse_id?: string;
  item_id?: string;
  page?: number;
  limit?: number;
}

export const stockApi = {
  list: (orgSlug: string, params?: StockListParams) =>
    apiClient.get<StockLevel[]>(`/api/v1/${orgSlug}/inventory/stock`, params),

  listAdjustments: async (orgSlug: string, params?: AdjustmentListParams): Promise<StockAdjustment[]> => {
    const res = await apiClient.get<{ data: StockAdjustment[]; total: number } | StockAdjustment[]>(
      `/api/v1/${orgSlug}/inventory/adjustments`, params
    );
    return Array.isArray(res) ? res : (res as { data: StockAdjustment[] }).data ?? [];
  },

  createAdjustment: (orgSlug: string, data: CreateAdjustmentInput) =>
    apiClient.post<StockAdjustment>(`/api/v1/${orgSlug}/inventory/adjustments`, data),

  createBreakdown: (orgSlug: string, data: CreateBreakdownInput) =>
    apiClient.post<StockBreakdown>(`/api/v1/${orgSlug}/inventory/breakdowns`, data),

  getSummary: (orgSlug: string) =>
    apiClient.get<{
      totalItems: number;
      totalWarehouses: number;
      lowStockCount: number;
      outOfStockCount: number;
      totalValue?: number;
    }>(`/api/v1/${orgSlug}/inventory/summary`),

  bulkAvailability: (orgSlug: string, skus: string[]) =>
    apiClient.post<Record<string, { available: number; reserved: number }>>(`/api/v1/${orgSlug}/inventory/availability`, { skus }),
};
