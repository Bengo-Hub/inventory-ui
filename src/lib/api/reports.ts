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

export type UtilizationGranularity = 'day' | 'week' | 'biweek' | 'month';

export interface IngredientUtilizationParams {
  item_id: string;
  warehouse_id: string;
  from?: string;
  to?: string;
}

export interface IngredientUtilizationSummary {
  item_id: string;
  item_sku: string;
  item_name: string;
  unit?: string;
  warehouse_id: string;
  period_start: string;
  period_end: string;
  purchased_qty: number;
  purchased_cost: number;
  consumed_qty: number;
  consumed_cost: number;
  on_hand: number;
  available: number;
  reorder_level: number;
  daily_velocity: number;
  projected_days_of_cover?: number;
  last_restock_at?: string;
}

export interface TimeseriesRecipeSlice {
  recipe_id?: string;
  recipe_sku?: string;
  recipe_name: string;
  quantity: number;
  cost: number;
}

export interface TimeseriesPoint {
  bucket_start: string;
  bucket_end: string;
  quantity: number;
  cost: number;
  by_recipe: TimeseriesRecipeSlice[];
}

export interface StockLevelEventDTO {
  event_type: 'low' | 'out' | 'restocked';
  occurred_at: string;
  on_hand_at_event: number;
  reorder_level_at_event: number;
}

export interface IngredientUtilizationTimeseries {
  granularity: UtilizationGranularity;
  points: TimeseriesPoint[];
  reorder_level: number;
  stock_level_events: StockLevelEventDTO[];
}

export interface RecipeBreakdownRow {
  recipe_id?: string;
  recipe_sku?: string;
  recipe_name: string;
  quantity: number;
  cost: number;
  pct_of_total: number;
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

  ingredientUtilizationSummary: (orgSlug: string, params: IngredientUtilizationParams): Promise<IngredientUtilizationSummary> =>
    apiClient.get<IngredientUtilizationSummary>(`/api/v1/${orgSlug}/inventory/reports/ingredient-utilization/summary`, params as unknown as Record<string, string>),

  ingredientUtilizationTimeseries: (
    orgSlug: string,
    params: IngredientUtilizationParams & { granularity: UtilizationGranularity; recipe_id?: string[] },
  ): Promise<IngredientUtilizationTimeseries> =>
    apiClient.get<IngredientUtilizationTimeseries>(`/api/v1/${orgSlug}/inventory/reports/ingredient-utilization/timeseries`, params as unknown as Record<string, string>),

  ingredientUtilizationByRecipe: (orgSlug: string, params: IngredientUtilizationParams): Promise<RecipeBreakdownRow[]> =>
    apiClient.get<RecipeBreakdownRow[]>(`/api/v1/${orgSlug}/inventory/reports/ingredient-utilization/by-recipe`, params as unknown as Record<string, string>),

  ingredientUtilizationDoc: (orgSlug: string, params: IngredientUtilizationParams & { format?: 'pdf' | 'csv' }): Promise<Blob> =>
    apiClient.getBlob(`/api/v1/${orgSlug}/inventory/reports/ingredient-utilization.pdf`, params as unknown as Record<string, string>),
};
