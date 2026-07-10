'use client';

import { useQuery } from '@tanstack/react-query';
import {
  reportsApi,
  type DeadstockReport,
  type FoodCostVarianceParams,
  type IngredientUtilizationParams,
  type IngredientUtilizationSummary,
  type IngredientUtilizationTimeseries,
  type MenuEngineeringParams,
  type MenuMatrixItem,
  type RecipeBreakdownRow,
  type StockValuation,
  type UtilizationGranularity,
  type VarianceReportItem,
} from '@/lib/api/reports';

const REPORTS_KEY = 'reports';

export function useFoodCostVariance(orgSlug: string, params?: FoodCostVarianceParams) {
  return useQuery<VarianceReportItem[]>({
    queryKey: [REPORTS_KEY, 'food-cost-variance', orgSlug, params],
    queryFn: () => reportsApi.foodCostVariance(orgSlug, params),
    enabled: !!orgSlug,
    staleTime: 5 * 60_000,
  });
}

export function useMenuEngineering(orgSlug: string, params?: MenuEngineeringParams) {
  return useQuery<MenuMatrixItem[]>({
    queryKey: [REPORTS_KEY, 'menu-engineering', orgSlug, params],
    queryFn: () => reportsApi.menuEngineering(orgSlug, params),
    enabled: !!orgSlug,
    staleTime: 5 * 60_000,
  });
}

export function useStockValuation(orgSlug: string) {
  return useQuery<StockValuation>({
    queryKey: [REPORTS_KEY, 'stock-valuation', orgSlug],
    queryFn: () => reportsApi.stockValuation(orgSlug),
    enabled: !!orgSlug,
    staleTime: 5 * 60_000,
  });
}

export function useDeadstock(orgSlug: string, days = 90) {
  return useQuery<DeadstockReport>({
    queryKey: [REPORTS_KEY, 'deadstock', orgSlug, days],
    queryFn: () => reportsApi.deadstock(orgSlug, days),
    enabled: !!orgSlug,
    staleTime: 5 * 60_000,
  });
}

// Ingredient Utilization — how much of a raw ingredient was consumed by which recipe over
// time, relative to its reorder level. item_id/warehouse_id are required (empty string
// disables the query until the user picks both). A short refetchInterval on the "today"-
// leaning default range keeps this near-real-time without a new push channel — matches the
// polling convention every other report in this app already uses.
export function useIngredientUtilizationSummary(orgSlug: string, params: IngredientUtilizationParams) {
  return useQuery<IngredientUtilizationSummary>({
    queryKey: [REPORTS_KEY, 'ingredient-utilization', 'summary', orgSlug, params],
    queryFn: () => reportsApi.ingredientUtilizationSummary(orgSlug, params),
    enabled: !!orgSlug && !!params.item_id && !!params.warehouse_id,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function useIngredientUtilizationTimeseries(
  orgSlug: string,
  params: IngredientUtilizationParams & { granularity: UtilizationGranularity; recipe_id?: string[] },
) {
  return useQuery<IngredientUtilizationTimeseries>({
    queryKey: [REPORTS_KEY, 'ingredient-utilization', 'timeseries', orgSlug, params],
    queryFn: () => reportsApi.ingredientUtilizationTimeseries(orgSlug, params),
    enabled: !!orgSlug && !!params.item_id && !!params.warehouse_id,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}

export function useIngredientUtilizationByRecipe(orgSlug: string, params: IngredientUtilizationParams) {
  return useQuery<RecipeBreakdownRow[]>({
    queryKey: [REPORTS_KEY, 'ingredient-utilization', 'by-recipe', orgSlug, params],
    queryFn: () => reportsApi.ingredientUtilizationByRecipe(orgSlug, params),
    enabled: !!orgSlug && !!params.item_id && !!params.warehouse_id,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });
}
