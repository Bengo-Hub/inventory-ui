import { apiClient } from './client';

export interface PricingTier {
  id: string;
  name: string;
  code?: string;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
}

export type TierBasis = 'default' | 'nightly' | 'per_session' | 'per_delegate_per_day' | 'peak' | 'off_peak';

export const TIER_BASES: { value: TierBasis; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'nightly', label: 'Nightly (room)' },
  { value: 'per_session', label: 'Per Session (facility)' },
  { value: 'per_delegate_per_day', label: 'Per Delegate / Day (conference)' },
  { value: 'peak', label: 'Peak' },
  { value: 'off_peak', label: 'Off-Peak' },
];

export interface ItemPricing {
  item_id: string;
  item_name?: string;
  item_sku?: string;
  pricing_tier_id: string;
  tier_name?: string;
  tier_code?: string;
  price: number;
  currency?: string;
  /** Outlet-level rate override (null = applies to all outlets). */
  outlet_id?: string | null;
  /** Pricing basis/season for hospitality rate tiers. */
  tier_basis?: TierBasis;
}

export interface CreateTierInput {
  name: string;
  code?: string;
  description?: string;
  is_default?: boolean;
}

// The PUT /items/{id}/pricing endpoint accepts an ARRAY of these entries (one per tier).
export interface UpsertItemPricingEntry {
  pricing_tier_id: string;
  price: number;
  currency?: string;
  outlet_id?: string | null;
  tier_basis?: TierBasis;
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

  upsertItemPricing: (orgSlug: string, itemId: string, entries: UpsertItemPricingEntry[]) =>
    apiClient.put<ItemPricing[]>(`/api/v1/${orgSlug}/inventory/items/${itemId}/pricing`, entries),

  listAllItemPricing: (orgSlug: string) =>
    apiClient.get<ItemPricing[]>(`/api/v1/${orgSlug}/inventory/items/pricing`),
};
