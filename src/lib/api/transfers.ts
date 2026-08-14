import { apiClient } from './client';

export type TransferStatus = 'draft' | 'pending' | 'in_transit' | 'received' | 'cancelled';

// Origin distinguishes a normal user-initiated transfer ("manual", the New Transfer dialog) from
// one auto-recorded after the fact by another feature — currently only "bulk_adjust" (a bulk
// stock adjustment whose lines specified a destination warehouse). Auto-recorded transfers are
// already "received" (the move already happened) and exist purely so it shows up with a
// transfer_number in this list, same as a manually-created one.
export type TransferOrigin = 'manual' | 'bulk_adjust' | string;

export interface TransferSummary {
  id: string;
  transfer_number: string;
  status: TransferStatus;
  origin: TransferOrigin;
  source_warehouse_name: string;
  destination_warehouse_name: string;
  line_count: number;
  shipped_at?: string;
  received_at?: string;
  created_at: string;
}

export interface TransferItem {
  id: string;
  item_id: string;
  item_name?: string;
  item_sku?: string;
  quantity: number;
  received_qty?: number;
  variance_reason?: string;
}

export interface TransferWarehouse {
  id: string;
  name: string;
  code?: string;
  address?: string;
}

export interface Transfer {
  id: string;
  transfer_number: string;
  source_warehouse: TransferWarehouse;
  destination_warehouse: TransferWarehouse;
  status: TransferStatus;
  origin: TransferOrigin;
  notes?: string;
  reference_no?: string;
  shipping_charges?: number;
  carrier?: string;
  freight_notes?: string;
  lines: TransferItem[];
  shipped_at?: string;
  received_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTransferInput {
  source_warehouse_id: string;
  destination_warehouse_id: string;
  notes?: string;
  reference_no?: string;
  shipping_charges?: number;
  carrier?: string;
  freight_notes?: string;
  items: { item_id: string; quantity: number }[];
}

// Amends a DRAFT transfer's line items + header fields — source/destination warehouse are
// immutable so they aren't part of this shape (cancel + recreate covers a wrong-warehouse pick).
export interface UpdateTransferInput {
  notes?: string;
  reference_no?: string;
  shipping_charges?: number;
  carrier?: string;
  freight_notes?: string;
  items: { item_id: string; quantity: number }[];
}

export interface TransferListParams {
  status?: TransferStatus;
  warehouse_id?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export const transfersApi = {
  list: async (orgSlug: string, params?: TransferListParams): Promise<TransferSummary[]> => {
    const res = await apiClient.get<{ items: TransferSummary[]; total: number }>(`/api/v1/${orgSlug}/inventory/transfers`, params);
    return res.items ?? [];
  },

  get: (orgSlug: string, id: string) =>
    apiClient.get<Transfer>(`/api/v1/${orgSlug}/inventory/transfers/${id}`),

  create: (orgSlug: string, data: CreateTransferInput) =>
    apiClient.post<Transfer>(`/api/v1/${orgSlug}/inventory/transfers`, data),

  update: (orgSlug: string, id: string, data: UpdateTransferInput) =>
    apiClient.put<Transfer>(`/api/v1/${orgSlug}/inventory/transfers/${id}`, data),

  ship: (orgSlug: string, id: string) =>
    apiClient.post<Transfer>(`/api/v1/${orgSlug}/inventory/transfers/${id}/ship`, {}),

  // items is optional — omit entirely for "everything arrived as shipped" (every line credits
  // its full drafted quantity). line_id (NOT item_id) is the key the backend matches on, since a
  // transfer can carry more than one line for the same item (different lots/variants).
  receive: (orgSlug: string, id: string, items?: { item_id: string; line_id: string; received_qty: number; variance_reason?: string }[]) =>
    apiClient.post<Transfer>(`/api/v1/${orgSlug}/inventory/transfers/${id}/receive`, items ? { items } : undefined),

  cancel: (orgSlug: string, id: string) =>
    apiClient.post<Transfer>(`/api/v1/${orgSlug}/inventory/transfers/${id}/cancel`, {}),
};
