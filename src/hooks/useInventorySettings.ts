'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventorySettingsApi, type UpdateInventoryModulesInput, type UpdateInventorySettingsInput } from '@/lib/api/inventory-settings';
import { apiErrorMessage } from '@/lib/api/error-message';
import { toast } from 'sonner';

export function useInventorySettings(orgSlug: string) {
  return useQuery({
    queryKey: ['inventory-settings', orgSlug],
    queryFn: () => inventorySettingsApi.get(orgSlug),
    enabled: !!orgSlug,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpdateInventorySettings(orgSlug: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateInventorySettingsInput) => inventorySettingsApi.put(orgSlug, input),
    onSuccess: (data) => {
      qc.setQueryData(['inventory-settings', orgSlug], data);
      toast.success('Settings saved');
    },
    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to save settings')),
  });
}

export function useUpdateInventoryModules(orgSlug: string) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateInventoryModulesInput) => inventorySettingsApi.patchModules(orgSlug, input),
    onSuccess: (data) => {
      qc.setQueryData(['inventory-settings', orgSlug], data);
      toast.success('Module settings saved');
    },
    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to save module settings')),
  });
}
