import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '@/lib/api/analytics';

export function useTopItems(orgSlug: string, limit = 10, days = 30) {
  return useQuery({
    queryKey: ['analytics', 'top-items', orgSlug, limit, days],
    queryFn: () => analyticsApi.getTopItems(orgSlug, limit, days),
    staleTime: 5 * 60_000,
    placeholderData: [],
    enabled: !!orgSlug,
  });
}

export function useStockTrends(orgSlug: string, days = 30) {
  return useQuery({
    queryKey: ['analytics', 'stock-trends', orgSlug, days],
    queryFn: () => analyticsApi.getStockTrends(orgSlug, days),
    staleTime: 5 * 60_000,
    placeholderData: [],
    enabled: !!orgSlug,
  });
}

export function useInventoryDistribution(orgSlug: string) {
  return useQuery({
    queryKey: ['analytics', 'distribution', orgSlug],
    queryFn: () => analyticsApi.getDistribution(orgSlug),
    staleTime: 5 * 60_000,
    placeholderData: [],
    enabled: !!orgSlug,
  });
}

export function useReorderAlerts(orgSlug: string) {
  return useQuery({
    queryKey: ['analytics', 'reorder-alerts', orgSlug],
    queryFn: () => analyticsApi.getReorderAlerts(orgSlug),
    staleTime: 3 * 60_000,
    placeholderData: [],
    enabled: !!orgSlug,
  });
}

export function useAnalyticsSummary(orgSlug: string) {
  return useQuery({
    queryKey: ['analytics', 'summary', orgSlug],
    queryFn: () => analyticsApi.getEnhancedSummary(orgSlug),
    staleTime: 2 * 60_000,
    enabled: !!orgSlug,
  });
}
