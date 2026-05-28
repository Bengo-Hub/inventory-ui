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

export const reportsApi = {
  foodCostVariance: (orgSlug: string, params?: FoodCostVarianceParams): Promise<VarianceReportItem[]> =>
    apiClient.get<VarianceReportItem[]>(`/api/v1/${orgSlug}/inventory/reports/food-cost-variance`, params as Record<string, string | boolean | undefined>),

  menuEngineering: (orgSlug: string, params?: MenuEngineeringParams): Promise<MenuMatrixItem[]> =>
    apiClient.get<MenuMatrixItem[]>(`/api/v1/${orgSlug}/inventory/reports/menu-engineering`, params),
};
