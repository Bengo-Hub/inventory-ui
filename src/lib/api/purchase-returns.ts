import { apiClient } from './client';

export type ReturnPaymentStatus = 'pending' | 'due' | 'partial' | 'paid';

/** One returned item, with its name/SKU resolved server-side. */
export interface PurchaseReturnLine {
  id: string;
  item_id: string;
  item_name: string;
  sku: string;
  lot_id?: string | null;
  quantity: number;
  unit_cost: number;
  sub_total: number;
}

export interface PurchaseReturn {
  id: string;
  return_number: string;
  purchase_order_id?: string | null;
  goods_receipt_id?: string | null;
  supplier_id?: string | null;
  supplier_name?: string;
  /** Warehouse/location the goods left from. */
  warehouse_id?: string | null;
  warehouse_name?: string;
  outlet_id?: string | null;
  reason: string;
  return_amount: number;
  payment_status: ReturnPaymentStatus;
  date_returned: string;
  /** The return's calendar day (YYYY-MM-DD); render this, not date_returned, so the day never shifts. */
  date_returned_day?: string;
  added_by?: string | null;
  added_by_name?: string;
  item_count: number;
  total_quantity: number;
  items_summary: string;
  lines: PurchaseReturnLine[];
  /** Items whose stock-out failed on approval (approve response only). */
  stock_warnings?: string[];
}

export interface PurchaseReturnLineInput {
  item_id: string;
  quantity: number;
  sub_total: number;
}

export interface CreatePurchaseReturnInput {
  purchase_order_id?: string;
  supplier_id?: string;
  warehouse_id?: string;
  reason?: string;
  date_returned?: string;
  lines: PurchaseReturnLineInput[];
}

export interface ReturnListParams {
  payment_status?: ReturnPaymentStatus;
  supplier_id?: string;
  outlet_id?: string;
  warehouse_id?: string;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedReturns {
  data: PurchaseReturn[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const base = (org: string) => `/api/v1/${org}/inventory/purchase-returns`;

export const purchaseReturnsApi = {
  list: (org: string, params?: ReturnListParams): Promise<PaginatedReturns> => apiClient.get<PaginatedReturns>(base(org), params),
  get: (org: string, id: string) => apiClient.get<PurchaseReturn>(`${base(org)}/${id}`),
  create: (org: string, data: CreatePurchaseReturnInput) => apiClient.post<PurchaseReturn>(base(org), data),
  approve: (org: string, id: string) => apiClient.post<PurchaseReturn>(`${base(org)}/${id}/approve`, {}),
};
