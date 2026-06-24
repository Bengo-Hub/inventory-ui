import { apiClient } from './client';

export type GRNStatus = 'draft' | 'posted' | 'cancelled';

export interface GRNLine {
  id?: string;
  purchase_order_line_id?: string | null;
  item_id: string;
  quantity_received: number;
  quantity_accepted: number;
  quantity_rejected: number;
  unit_cost: number;
  rejection_reason?: string;
}

export interface GoodsReceipt {
  id: string;
  grn_number: string;
  purchase_order_id: string;
  supplier_id?: string | null;
  warehouse_id?: string | null;
  status: GRNStatus;
  notes?: string;
  received_date: string;
  lines?: GRNLine[];
}

export interface CreateGRNLineInput {
  purchase_order_line_id?: string;
  item_id: string;
  quantity_received: number;
  quantity_accepted?: number;
  quantity_rejected?: number;
  unit_cost?: number;
  rejection_reason?: string;
  /** Serial numbers for serial-tracked items: one per accepted unit. */
  serials?: string[];
}

export interface CreateGRNInput {
  warehouse_id?: string;
  received_by?: string;
  notes?: string;
  lines: CreateGRNLineInput[];
}

export interface GRNListParams { status?: GRNStatus; purchase_order_id?: string; page?: number; limit?: number; }
export interface PaginatedGRNs { data: GoodsReceipt[]; total: number; page: number; limit: number; hasMore: boolean; }

export interface MatchLine { item_id: string; ordered: number; received: number; status: string; }
export interface MatchResult {
  purchase_order_id: string;
  po_number: string;
  ordered_total: number;
  received_total: number;
  po_amount: number;
  invoiced_qty: number;
  invoice_total: number;
  status: string;
  lines: MatchLine[];
}

const base = (org: string) => `/api/v1/${org}/inventory/goods-receipts`;
const poBase = (org: string) => `/api/v1/${org}/inventory/purchase-orders`;

export const goodsReceiptsApi = {
  list: (org: string, params?: GRNListParams): Promise<PaginatedGRNs> => apiClient.get<PaginatedGRNs>(base(org), params),
  get: (org: string, id: string) => apiClient.get<GoodsReceipt>(`${base(org)}/${id}`),
  create: (org: string, poId: string, data: CreateGRNInput) => apiClient.post<GoodsReceipt>(`${poBase(org)}/${poId}/goods-receipts`, data),
  post: (org: string, id: string) => apiClient.post<GoodsReceipt>(`${base(org)}/${id}/post`, {}),
  match: (org: string, poId: string, invoicedQty?: number, invoiceTotal?: number): Promise<MatchResult> =>
    apiClient.get<MatchResult>(`${poBase(org)}/${poId}/match`, { invoiced_qty: invoicedQty, invoice_total: invoiceTotal }),
};
