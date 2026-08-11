import { apiClient } from './client';

export interface StockLevel {
  id: string;
  item_name: string;
  sku: string;
  warehouse_id: string;
  warehouse_name: string;
  on_hand: number;
  available: number;
  reserved: number;
  reorder_point?: number;
  unit?: string;
  unit_id?: string;
  category_id?: string;
  category_name?: string;
  type?: string;
}

export interface StockAdjustment {
  id: string;
  item_id: string;
  item_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  quantity_change: number;
  reason: string;
  reference?: string;
  notes?: string;
  adjusted_at: string;
  created_at: string;
}

export interface CreateAdjustmentInput {
  sku: string;
  adjustment: number;
  reason: string;
  reference?: string;
  notes?: string;
  warehouse_id?: string;
  unit_id?: string;
}

export interface CreateBreakdownInput {
  parent_sku: string;
  child_sku: string;
  parent_quantity: number;
  // Provide conversion_factor OR child_quantity; the backend derives child_quantity
  // from conversion_factor when child_quantity is omitted.
  conversion_factor?: number;
  child_quantity?: number;
  warehouse_id?: string;
  cost_allocated?: number;
  reference?: string;
  notes?: string;
}

export interface StockBreakdown {
  id: string;
  parent_sku: string;
  child_sku: string;
  parent_quantity: number;
  child_quantity: number;
  parent_on_hand: number;
  child_on_hand: number;
  created_at: string;
}

export interface StockListParams {
  warehouse_id?: string;
  search?: string;
  low_stock?: boolean;
  out_of_stock?: boolean;
  category_id?: string;
  type?: string;
  /** Scope to a single item's balances across every warehouse — the item drawer's Locations
   *  panel and the Move Stock dialog's "available at source" lookup both use this. */
  item_id?: string;
}

export interface StockExportParams extends StockListParams {
  format?: 'pdf' | 'csv';
  location_id?: string;
  outlet_id?: string;
  /** 'category' renders one section per category instead of one flat table. */
  group_by?: 'category';
}

export interface AdjustmentListParams {
  warehouse_id?: string;
  item_id?: string;
  page?: number;
  limit?: number;
}

export interface RelocateItemLocationInput {
  item_ids: string[];
  source_warehouse_id: string;
  destination_warehouse_id: string;
  notes?: string;
}

export interface RelocateItemLocationResult {
  processed: number;
  skipped: { item_id: string; reason: string }[];
}

export interface BulkAdjustStockInput {
  lines: { sku: string; adjustment: number }[];
  reason: string;
  reference?: string;
  notes?: string;
  warehouse_id?: string;
}

export interface BulkAdjustStockResult {
  processed: number;
  skipped: { sku: string; reason: string }[];
}

export const stockApi = {
  list: (orgSlug: string, params?: StockListParams) =>
    apiClient.get<StockLevel[]>(`/api/v1/${orgSlug}/inventory/stock`, params),

  // Branded PDF/CSV export of stock levels — same filters as list() plus warehouse/location
  // drill-down and an outlet override. Streamed from inventory-api's docs report engine.
  exportDoc: (orgSlug: string, params?: StockExportParams): Promise<Blob> =>
    apiClient.getBlob(`/api/v1/${orgSlug}/inventory/stock/export`, params as Record<string, string | boolean | undefined>),

  listAdjustments: async (orgSlug: string, params?: AdjustmentListParams): Promise<StockAdjustment[]> => {
    const res = await apiClient.get<{ data: StockAdjustment[]; total: number } | StockAdjustment[]>(
      `/api/v1/${orgSlug}/inventory/adjustments`, params
    );
    return Array.isArray(res) ? res : (res as { data: StockAdjustment[] }).data ?? [];
  },

  createAdjustment: (orgSlug: string, data: CreateAdjustmentInput) =>
    apiClient.post<StockAdjustment>(`/api/v1/${orgSlug}/inventory/adjustments`, data),

  createBreakdown: (orgSlug: string, data: CreateBreakdownInput) =>
    apiClient.post<StockBreakdown>(`/api/v1/${orgSlug}/inventory/breakdowns`, data),

  // Item location relocation — NOT a stock transfer: moves each item's entire current balance
  // (including zero) from one warehouse to another in one atomic call. No quantity to choose,
  // no ship/receive steps, no "insufficient stock" failure mode — see MoveStockDialog.tsx.
  relocate: (orgSlug: string, data: RelocateItemLocationInput) =>
    apiClient.post<RelocateItemLocationResult>(`/api/v1/${orgSlug}/inventory/stock/relocate`, data),

  bulkAdjust: (orgSlug: string, data: BulkAdjustStockInput) =>
    apiClient.post<BulkAdjustStockResult>(`/api/v1/${orgSlug}/inventory/stock/bulk-adjust`, data),

  getSummary: (orgSlug: string) =>
    apiClient.get<{
      totalItems: number;
      totalWarehouses: number;
      lowStockCount: number;
      outOfStockCount: number;
      totalValue?: number;
    }>(`/api/v1/${orgSlug}/inventory/summary`),

  bulkAvailability: (orgSlug: string, skus: string[]) =>
    apiClient.post<Record<string, { available: number; reserved: number }>>(`/api/v1/${orgSlug}/inventory/availability`, { skus }),

  // Product stock history — the Go-Digital-style per-item ledger (summary cards +
  // unified movement rows from adjustments/purchases/sales/returns/transfers).
  itemHistory: (orgSlug: string, sku: string, params?: StockHistoryParams) =>
    apiClient.get<StockHistoryResponse>(
      `/api/v1/${orgSlug}/inventory/items/${encodeURIComponent(sku)}/stock-history`,
      params as Record<string, string | number | undefined>,
    ),
};

// ── Product stock history ─────────────────────────────────────────────────────

export interface StockHistoryParams {
  warehouse_id?: string;
  /** RFC3339 or YYYY-MM-DD. */
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface StockMovementRow {
  type:
    | 'opening_stock'
    | 'purchase'
    | 'sale'
    | 'sell_return'
    | 'purchase_return'
    | 'transfer_in'
    | 'transfer_out'
    | 'adjustment';
  label: string;
  quantity_change: number;
  /** Stock level after the movement — present for adjustment-ledger rows only. */
  quantity_after?: number;
  occurred_at: string;
  reference?: string;
  warehouse_id?: string;
  warehouse_name?: string;
  actor_id?: string;
  /** Supplier name (purchases) or order reference (sales). */
  counterparty?: string;
}

export interface StockHistorySummary {
  opening_stock: number;
  total_purchased: number;
  total_sell_returns: number;
  transfers_in: number;
  total_sold: number;
  total_purchase_returns: number;
  transfers_out: number;
  /** Net of miscellaneous adjustments (damage, shrinkage, corrections…). */
  total_adjusted: number;
  current_stock: number;
}

export interface StockHistoryResponse {
  item: { id: string; sku: string; name: string; unit_abbreviation?: string };
  summary: StockHistorySummary;
  data: StockMovementRow[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
