'use client';

import { useQuery } from '@tanstack/react-query';
import {
  reportsApi,
  type DeadstockReport,
  type FoodCostVarianceParams,
  type MenuEngineeringParams,
  type MenuMatrixItem,
  type StockValuation,
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
