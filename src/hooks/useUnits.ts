'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { unitsApi, type CreateUnitInput } from '@/lib/api/units';

const UNITS_KEY = 'units';

export function useUnits(orgSlug: string) {
  return useQuery({
    queryKey: [UNITS_KEY, orgSlug],
    queryFn: () => unitsApi.list(orgSlug),
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
