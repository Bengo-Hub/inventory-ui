import { apiClient } from './client';

export interface PricingTier {
  id: string;
  name: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export interface ItemPricing {
  item_id: string;
  item_name?: string;
  item_sku?: string;
  tier_id: string;
  tier_name?: string;
  price: number;
  currency?: string;
}

export interface CreateTierInput {
  name: string;
  description?: string;
  is_default?: boolean;
}

export interface UpsertItemPricingInput {
  price: number;
}

export const pricingApi = {
  listTiers: (orgSlug: string) =>
    apiClient.get<PricingTier[]>(`/api/v1/${orgSlug}/inventory/pricing-tiers`),

  createTier: (orgSlug: string, data: CreateTierInput) =>
    apiClient.post<PricingTier>(`/api/v1/${orgSlug}/inventory/pricing-tiers`, data),

  updateTier: (orgSlug: string, tierId: string, data: Partial<CreateTierInput>) =>
    apiClient.put<PricingTier>(`/api/v1/${orgSlug}/inventory/pricing-tiers/${tierId}`, data),

  deleteTier: (orgSlug: string, tierId: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/pricing-tiers/${tierId}`),

  getItemPricing: (orgSlug: string, itemId: string) =>
    apiClient.get<ItemPricing[]>(`/api/v1/${orgSlug}/inventory/items/${itemId}/pricing`),

  upsertItemPricing: (orgSlug: string, itemId: string, data: UpsertItemPricingInput) =>
    apiClient.put<ItemPricing>(`/api/v1/${orgSlug}/inventory/items/${itemId}/pricing`, data),

  listAllItemPricing: (orgSlug: string) =>
    apiClient.get<ItemPricing[]>(`/api/v1/${orgSlug}/inventory/items/pricing`),
};
