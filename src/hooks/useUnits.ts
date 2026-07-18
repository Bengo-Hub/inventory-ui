'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unitsApi, type CreateUnitInput } from '@/lib/api/units';
import { useOutletStore } from '@/store/outlet';

const UNITS_KEY = 'units';

// Units are scoped to the selected outlet's use_case (untagged units are
// universal; tagged ones — tot/pot/portion → hospitality — only surface for
// their vertical). HQ "All Outlets" (no use_case) sees everything.
export function useUnits(orgSlug: string) {
  const useCase = useOutletStore((s) => s.outlet?.use_case) ?? null;
  return useQuery({
    queryKey: [UNITS_KEY, orgSlug, useCase ?? 'all'],
    queryFn: () => unitsApi.list(orgSlug, useCase),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 120_000,
  });
}

export function useCreateUnit(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUnitInput) => unitsApi.create(orgSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [UNITS_KEY, orgSlug] });
    },
  });
}

export function useDeleteUnit(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unitsApi.delete(orgSlug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [UNITS_KEY, orgSlug] });
    },
  });
}
