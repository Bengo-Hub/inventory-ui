'use client';

import { useQuery } from '@tanstack/react-query';
import { procurementApi, type PaginatedSupplierPerformance } from '@/lib/api/procurement';

const EMPTY_SP: PaginatedSupplierPerformance = { data: [], total: 0, page: 1, limit: 20, hasMore: false };

export function useProcurementDashboard(org: string) {
  return useQuery({
    queryKey: ['procurement-dashboard', org],
    queryFn: () => procurementApi.dashboard(org),
    enabled: !!org,
    staleTime: 120_000,
  });
}

export function useSupplierPerformance(org: string) {
  return useQuery<PaginatedSupplierPerformance>({
    queryKey: ['supplier-performance', org],
    queryFn: () => procurementApi.supplierPerformance(org),
    enabled: !!org,
    placeholderData: EMPTY_SP,
    staleTime: 120_000,
  });
}
