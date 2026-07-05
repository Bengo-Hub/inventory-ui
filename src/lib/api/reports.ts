import { apiClient } from './client';

export interface VarianceReportItem {
  recipe_sku: string;
  recipe_name: string;
  theoretical_cost: number;
  actual_cost: number;
  variance_pct: number;
  breakdown?: Record<string, number>;
}

export type MenuCategory = 'STAR' | 'PLOWHORSE' | 'PUZZLE' | 'DOG';

export interface MenuMatrixItem {
  recipe_sku: string;
  recipe_name: string;
  popularity: number;
  contrib_margin: number;
  category: MenuCategory;
  suggested_price?: number;
}

export interface FoodCostVarianceParams {
  from?: string;
  to?: string;
  recalculate?: boolean;
  tenant_slug?: string;
}

export interface MenuEngineeringParams {
  from?: string;
  to?: string;
  tenant_slug?: string;
}

export interface StockValuationItem {
  item_id: string;
  sku: string;
  name: string;
  category_name?: string;
  on_hand: number;
  unit_cost: number;
  value: number;
}

export interface StockValuationCategory {
  category_id?: string;
  category_name: string;
  item_count: number;
  total_units: number;
  total_value: number;
}

export interface StockValuation {
  currency: string;
  total_value: number;
  total_units: number;
  item_count: number;
  by_category: StockValuationCategory[];
  top_items: StockValuationItem[];
}

export interface DeadstockItem {
  item_id: string;
  sku: string;
  name: string;
  category_name?: string;
  on_hand: number;
  unit_cost: number;
  value: number;
  last_activity: string;
}

export interface DeadstockReport {
  days: number;
  currency: string;
  item_count: number;
  total_dead_value: number;
  items: DeadstockItem[];
}

export const reportsApi = {
  foodCostVariance: (orgSlug: string, params?: FoodCostVarianceParams): Promise<VarianceReportItem[]> =>
    apiClient.get<VarianceReportItem[]>(`/api/v1/${orgSlug}/inventory/reports/food-cost-variance`, params as Record<string, string | boolean | undefined>),

  menuEngineering: (orgSlug: string, params?: MenuEngineeringParams): Promise<MenuMatrixItem[]> =>
    apiClient.get<MenuMatrixItem[]>(`/api/v1/${orgSlug}/inventory/reports/menu-engineering`, params),

  stockValuation: (orgSlug: string): Promise<StockValuation> =>
    apiClient.get<StockValuation>(`/api/v1/${orgSlug}/inventory/reports/stock-valuation`),

  deadstock: (orgSlug: string, days = 90): Promise<DeadstockReport> =>
    apiClient.get<DeadstockReport>(`/api/v1/${orgSlug}/inventory/reports/deadstock`, { days: String(days) }),

  // Branded document exports (PDF/CSV) — streamed from inventory-api's *.pdf report endpoints and
  // fed to the shared PDF previewer. Each mirrors the JSON report's query params so the exported
  // document matches what the page shows.
  stockValuationDoc: (orgSlug: string, format: 'pdf' | 'csv' = 'pdf'): Promise<Blob> =>
    apiClient.getBlob(`/api/v1/${orgSlug}/inventory/reports/stock-valuation.pdf`, { format }),

  deadstockDoc: (orgSlug: string, days = 90, format: 'pdf' | 'csv' = 'pdf'): Promise<Blob> =>
    apiClient.getBlob(`/api/v1/${orgSlug}/inventory/reports/deadstock.pdf`, { days: String(days), format }),

  foodCostVarianceDoc: (orgSlug: string, params?: FoodCostVarianceParams & { format?: 'pdf' | 'csv' }): Promise<Blob> =>
    apiClient.getBlob(`/api/v1/${orgSlug}/inventory/reports/food-cost-variance.pdf`, params as Record<string, string | boolean | undefined>),

  menuEngineeringDoc: (orgSlug: string, params?: MenuEngineeringParams & { format?: 'pdf' | 'csv' }): Promise<Blob> =>
    apiClient.getBlob(`/api/v1/${orgSlug}/inventory/reports/menu-engineering.pdf`, params as Record<string, string | undefined>),
};
