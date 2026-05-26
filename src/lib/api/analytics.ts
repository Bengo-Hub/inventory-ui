import { apiClient } from '@/lib/api/client';

export interface TopItem {
  item_id: string;
  sku: string;
  item_name: string;
  category: string;
  units_moved: number;
}

export interface StockTrendPoint {
  date: string;
  total_units: number;
  adjustment_count: number;
}

export interface CategoryDistribution {
  category_id: string | null;
  category_name: string;
  item_count: number;
  total_units: number;
  percentage: number;
}

export interface ReorderAlert {
  item_id: string;
  sku: string;
  item_name: string;
  warehouse_id: string;
  warehouse_name: string;
  current_qty: number;
  reorder_level: number;
  deficit: number;
}

export interface AnalyticsSummary {
  total_items: number;
  low_stock_count: number;
  out_of_stock_count: number;
  warehouse_count: number;
  pending_po_count: number;
  total_inventory_value: number;
}

export const analyticsApi = {
  getTopItems: (orgSlug: string, limit = 10, days = 30) =>
    apiClient.get<TopItem[]>(`/api/v1/${orgSlug}/inventory/analytics/top-items?limit=${limit}&days=${days}`),

  getStockTrends: (orgSlug: string, days = 30) =>
    apiClient.get<StockTrendPoint[]>(`/api/v1/${orgSlug}/inventory/analytics/stock-trends?days=${days}`),

  getDistribution: (orgSlug: string) =>
    apiClient.get<CategoryDistribution[]>(`/api/v1/${orgSlug}/inventory/analytics/distribution`),

  getReorderAlerts: (orgSlug: string) =>
    apiClient.get<ReorderAlert[]>(`/api/v1/${orgSlug}/inventory/analytics/reorder-alerts`),

  getEnhancedSummary: (orgSlug: string) =>
    apiClient.get<AnalyticsSummary>(`/api/v1/${orgSlug}/inventory/analytics/summary`),
};
