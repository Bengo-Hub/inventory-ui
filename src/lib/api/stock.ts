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
}

export interface StockListParams {
  warehouse_id?: string;
  search?: string;
  low_stock?: boolean;
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
