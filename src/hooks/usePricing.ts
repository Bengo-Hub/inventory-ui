'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { pricingApi, type CreateTierInput, type GenerateTierPricingInput, type UpsertItemPricingEntry } from '@/lib/api/pricing';

const TIERS_KEY = 'pricing-tiers';
const PRICING_KEY = 'item-pricing';

export function usePricingTiers(orgSlug: string) {
  return useQuery({
    queryKey: [TIERS_KEY, orgSlug],
    queryFn: () => pricingApi.listTiers(orgSlug),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 120_000,
  });
}

export function useCreatePricingTier(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTierInput) => pricingApi.createTier(orgSlug, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TIERS_KEY, orgSlug] });
    },
  });
}

export function useUpdatePricingTier(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTierInput> }) =>
      pricingApi.updateTier(orgSlug, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TIERS_KEY, orgSlug] });
    },
  });
}

export function useDeletePricingTier(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => pricingApi.deleteTier(orgSlug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TIERS_KEY, orgSlug] });
    },
  });
}

export function useItemPricing(orgSlug: string, itemId: string) {
  return useQuery({
    queryKey: [PRICING_KEY, orgSlug, itemId],
    queryFn: () => pricingApi.getItemPricing(orgSlug, itemId),
    enabled: !!orgSlug && !!itemId,
    staleTime: 60_000,
  });
}

export function useUpsertItemPricing(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, entries }: { itemId: string; entries: UpsertItemPricingEntry[] }) =>
      pricingApi.upsertItemPricing(orgSlug, itemId, entries),
    onSuccess: (_, { itemId }) => {
      queryClient.invalidateQueries({ queryKey: [PRICING_KEY, orgSlug, itemId] });
      queryClient.invalidateQueries({ queryKey: [PRICING_KEY, orgSlug] });
    },
  });
}

export function useGenerateTierPricing(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tierId, body }: { tierId: string; body: GenerateTierPricingInput }) =>
      pricingApi.generateTierPricing(orgSlug, tierId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PRICING_KEY, orgSlug] });
    },
  });
}

export function useAllItemPricing(orgSlug: string) {
  return useQuery({
    queryKey: [PRICING_KEY, orgSlug, 'all'],
    queryFn: () => pricingApi.listAllItemPricing(orgSlug),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 60_000,
  });
}
