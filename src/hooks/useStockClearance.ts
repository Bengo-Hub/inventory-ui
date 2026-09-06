'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { stockClearanceApi, type StartClearanceInput } from '@/lib/api/stock-clearance';
import { apiErrorMessage } from '@/lib/api/error-message';
import { toast } from 'sonner';

const AGING_STOCK_KEY = 'aging-stock';

export function useAgingStock(orgSlug: string, enabled = true) {
  return useQuery({
    queryKey: [AGING_STOCK_KEY, orgSlug],
    queryFn: () => stockClearanceApi.agingStock(orgSlug),
    enabled: !!orgSlug && enabled,
    staleTime: 60_000,
  });
}

export function useStartClearance(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, input }: { itemId: string; input: StartClearanceInput }) =>
      stockClearanceApi.startClearance(orgSlug, itemId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [AGING_STOCK_KEY, orgSlug] });
      toast.success('Clearance started');
    },
    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to start clearance')),
  });
}

export function useCancelClearance(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => stockClearanceApi.cancelClearance(orgSlug, itemId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [AGING_STOCK_KEY, orgSlug] });
      toast.success('Clearance cancelled');
    },
    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to cancel clearance')),
  });
}
