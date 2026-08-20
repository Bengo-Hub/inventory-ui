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
  /** true when this outlet's copy of the item was hidden via the Set Outlets checkbox modal
   *  (SetItemOutletMembership) — quantity is frozen, not cleared. Only ever true when the
   *  request was sent with `include_hidden: true`; the default list excludes these rows. */
  removed_from_location?: boolean;
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
  /** Also return balances hidden via the Set Outlets modal (removed_from_location=true),
   *  tagged with `removed_from_location: true` on those rows. Default false everywhere except
   *  the item drawer's outlet breakdown — the main Stock Levels list/export and Move Stock's
   *  "current outlets" pre-check must keep seeing only active balances. */
  include_hidden?: boolean;
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
  date_from?: string;
  date_to?: string;
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
  lines: { sku: string; adjustment: number; destination_warehouse_id?: string }[];
  reason: string;
  reference?: string;
  notes?: string;
  warehouse_id?: string;
}

export interface SetItemOutletMembershipInput {
  item_ids: string[];
  target_warehouse_ids: string[];
  notes?: string;
  /** Only applies to a clean 1-dropped+1-added pair, and only takes effect when
   * `move_with_stock` is set: moves exactly this amount, leaving the remainder active (hidden,
   * never discarded) at the source, instead of moving everything. */
  move_quantity?: number;
  /** Opt-in: dropped outlets' stock is discarded rather than hidden, newly-added outlets start
   * at zero. Confirm with the user before sending this (mutually exclusive with
   * `move_with_stock`) — it's the one mode that makes real on-hand quantity vanish. */
  zero_stock_mode?: boolean;
  /** Opt-in: dropped outlets' stock is carried to the newly-added outlet(s) instead of the
   * default (just hide, quantity untouched). Requires `target_warehouse_ids` to include at
   * least one new destination — the API rejects an empty target set with this flag set.
   * Mutually exclusive with `zero_stock_mode`. */
  move_with_stock?: boolean;
}

/** Returned by any endpoint that queues a background bulk job — see BulkJob below. */
export interface BulkJobAccepted {
  job_id: string;
  status: string;
  total: number;
}

export interface BulkJob {
  id: string;
  tenant_id: string;
  job_type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  total: number;
  processed: number;
  failed_count: number;
  result?: { skipped?: { item_id?: string; sku?: string; reason: string }[] };
  error?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
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

  // Both queue a background job and return immediately — see BulkJob / useBulkJobStatus and the
  // org-shell notification listener for the bulk_job.completed push.
  bulkAdjust: (orgSlug: string, data: BulkAdjustStockInput) =>
    apiClient.post<BulkJobAccepted>(`/api/v1/${orgSlug}/inventory/stock/bulk-adjust`, data),

  // The checkbox catalog-movement UX: check the outlets an item should be stocked in, uncheck
  // the rest. Superseded RelocateItemLocationInput/relocate() as the frontend's entry point —
  // see OutletMembershipDialog.tsx.
  setMembership: (orgSlug: string, data: SetItemOutletMembershipInput) =>
    apiClient.post<BulkJobAccepted>(`/api/v1/${orgSlug}/inventory/stock/set-membership`, data),

  getBulkJob: (orgSlug: string, jobId: string) =>
    apiClient.get<BulkJob>(`/api/v1/${orgSlug}/inventory/bulk-jobs/${jobId}`),

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
