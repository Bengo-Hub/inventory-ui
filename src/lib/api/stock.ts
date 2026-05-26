import { apiClient } from './client';

export interface StockLevel {
  id: string;
  itemName: string;
  itemSku: string;
  warehouseId: string;
  warehouseName: string;
  quantity: number;
  reservedQty: number;
  availableQty: number;
  reorderLevel?: number;
  updatedAt: string;
}

export interface StockAdjustment {
  id: string;
  itemId: string;
  itemName?: string;
  warehouseId: string;
  warehouseName?: string;
  adjustmentType: string;
  quantity: number;
  reason: string;
  note?: string;
  createdAt: string;
  createdBy?: string;
}

export interface CreateAdjustmentInput {
  item_id: string;
  warehouse_id: string;
  adjustment_type: 'add' | 'remove' | 'set';
  quantity: number;
  reason: string;
  note?: string;
  lot_id?: string;
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

  listAdjustments: (orgSlug: string, params?: AdjustmentListParams) =>
    apiClient.get<StockAdjustment[]>(`/api/v1/${orgSlug}/inventory/adjustments`, params),

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
