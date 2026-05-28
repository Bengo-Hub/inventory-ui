import { apiClient } from './client';

export interface VarianceReportItem {
  recipe_sku: string;
  recipe_name: string;
  theoretical_cost: number;
  actual_cost: number;
  variance_pct: number;
  breakdown?: Record<string, number>;
}

export interface FoodCostVarianceParams {
  from?: string;
  to?: string;
  recalculate?: boolean;
  tenant_slug?: string;
}

export const reportsApi = {
  foodCostVariance: (orgSlug: string, params?: FoodCostVarianceParams): Promise<VarianceReportItem[]> =>
    apiClient.get<VarianceReportItem[]>(`/api/v1/${orgSlug}/inventory/reports/food-cost-variance`, params as Record<string, string | boolean | undefined>),
};
