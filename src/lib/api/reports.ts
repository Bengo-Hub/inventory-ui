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

export interface StockValuationBrand {
  brand_id?: string;
  brand_name: string;
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
  by_brand?: StockValuationBrand[];
  /** One page of items by value (offset, limit); totals cover every matching item. */
  top_items: StockValuationItem[];
  offset?: number;
  limit?: number;
}

export interface DeadstockItem {
  item_id: string;
  sku: string;
  name: string;
  category_name?: string;
  brand_name?: string;
  on_hand: number;
  unit_cost: number;
  value: number;
  last_activity: string;
  /** No sale or usage was ever recorded here; last_activity is then the last stock change. */
  never_used?: boolean;
  /** When the oldest unit still held arrived. */
  held_since?: string;
  days_held?: number;
}

export interface DeadstockReport {
  days: number;
  currency: string;
  item_count: number;
  total_dead_value: number;
  /** Idle stock that arrived inside the window: not judged yet. */
  too_new_count?: number;
  too_new_value?: number;
  /** Earliest stock record in scope; before it there is no history. */
  history_since?: string;
  offset?: number;
  limit?: number;
  items: DeadstockItem[];
}

/** Item filters shared by the stock reports (all optional). */
export interface ReportItemFilters {
  categoryId?: string;
  brandId?: string;
  search?: string;
  offset?: number;
  limit?: number;
}

function filterParams(f?: ReportItemFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (f?.categoryId) out.category_id = f.categoryId;
  if (f?.brandId) out.brand_id = f.brandId;
  if (f?.search?.trim()) out.search = f.search.trim();
  if (f?.offset) out.offset = String(f.offset);
  if (f?.limit) out.limit = String(f.limit);
  return out;
}

export interface FastMovingItem {
  item_id: string;
  sku: string;
  name: string;
  category_name?: string;
  on_hand: number;
  quantity_moved: number;
  last_activity: string;
}

/** Items ranked by units moved (sold, used in production or meals) within the window. */
export interface FastMovingReport {
  days: number;
  /** Every item that moved; items is one page of them, busiest first. */
  item_count: number;
  offset?: number;
  limit?: number;
  items: FastMovingItem[];
}

/** Where a stock report looks: one warehouse, or an outlet's own warehouses. */
export interface ReportLocationScope {
  warehouseId?: string;
  outletId?: string;
}

function locationParams(scope?: ReportLocationScope): Record<string, string> {
  const out: Record<string, string> = {};
  if (scope?.warehouseId) out.warehouse_id = scope.warehouseId;
  if (scope?.outletId) out.outlet_id = scope.outletId;
  return out;
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

  // Scope: warehouseId picks one location; else outletId covers that outlet's own locations;
  // neither means every location. Filters narrow by category, brand and search.
  stockValuation: (orgSlug: string, scope?: ReportLocationScope, filters?: ReportItemFilters): Promise<StockValuation> =>
    apiClient.get<StockValuation>(`/api/v1/${orgSlug}/inventory/reports/stock-valuation`, { ...locationParams(scope), ...filterParams(filters) }),

  deadstock: (orgSlug: string, days = 90, scope?: ReportLocationScope, filters?: ReportItemFilters): Promise<DeadstockReport> =>
    apiClient.get<DeadstockReport>(`/api/v1/${orgSlug}/inventory/reports/deadstock`, { days: String(days), ...locationParams(scope), ...filterParams(filters) }),

  // Branded document exports (PDF/CSV) — streamed from inventory-api's *.pdf report endpoints and
  // fed to the shared PDF previewer. Each mirrors the JSON report's query params so the exported
  // document matches what the page shows.
  stockValuationDoc: (orgSlug: string, format: 'pdf' | 'csv' = 'pdf', scope?: ReportLocationScope, filters?: ReportItemFilters): Promise<Blob> =>
    apiClient.getBlob(`/api/v1/${orgSlug}/inventory/reports/stock-valuation.pdf`, { format, ...locationParams(scope), ...filterParams(filters) }),

  fastMoving: (orgSlug: string, days = 90, scope?: ReportLocationScope, filters?: ReportItemFilters): Promise<FastMovingReport> =>
    apiClient.get<FastMovingReport>(`/api/v1/${orgSlug}/inventory/reports/fast-moving`, { days: String(days), ...locationParams(scope), ...filterParams(filters) }),

  fastMovingDoc: (orgSlug: string, days = 90, format: 'pdf' | 'csv' = 'pdf', scope?: ReportLocationScope, filters?: ReportItemFilters): Promise<Blob> =>
    apiClient.getBlob(`/api/v1/${orgSlug}/inventory/reports/fast-moving.pdf`, { days: String(days), format, ...locationParams(scope), ...filterParams(filters) }),

  deadstockDoc: (orgSlug: string, days = 90, format: 'pdf' | 'csv' = 'pdf', scope?: ReportLocationScope, filters?: ReportItemFilters): Promise<Blob> =>
    apiClient.getBlob(`/api/v1/${orgSlug}/inventory/reports/deadstock.pdf`, { days: String(days), format, ...locationParams(scope), ...filterParams(filters) }),

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
