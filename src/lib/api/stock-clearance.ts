import { apiClient } from './client';

// Add-on (2026-09-06 pricing/tiering plan, Phase 2): stock-age/batch markdown pricing. Requires
// the platform-admin "batch_period_pricing" TenantFeatureGrant AND the tenant's own
// batch_period_pricing_enabled settings toggle before this becomes usable.

export interface AgingStockRow {
  item_id: string;
  sku: string;
  name: string;
  current_price: number;
  oldest_received_at: string;
  aged_quantity: number;
  age_days: number;
}

export interface AgingStockResponse {
  threshold_days: number;
  items: AgingStockRow[];
}

export interface StockClearance {
  id: string;
  tenant_id: string;
  item_id: string;
  markdown_price: number;
  reference_before: string;
  starts_at: string;
  ends_at?: string | null;
  status: 'active' | 'expired' | 'depleted' | 'cancelled';
  ended_at?: string | null;
  created_by?: string | null;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StartClearanceInput {
  markdown_price: number;
  reference_before?: string;
  ends_at?: string | null;
  notes?: string;
}

export const stockClearanceApi = {
  agingStock: (orgSlug: string) =>
    apiClient.get<AgingStockResponse>(`/api/v1/${orgSlug}/inventory/aging-stock`),

  startClearance: (orgSlug: string, itemId: string, body: StartClearanceInput) =>
    apiClient.post<StockClearance>(`/api/v1/${orgSlug}/inventory/items/${itemId}/clearance`, body),

  cancelClearance: (orgSlug: string, itemId: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/items/${itemId}/clearance`),
};
