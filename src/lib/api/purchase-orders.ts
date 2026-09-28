import { apiClient } from './client';

export type POStatus = 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled';

export interface POLineItem {
  id: string;
  item_id: string;
  item_name?: string;
  item_sku?: string;
  quantity: number;
  received_qty: number;
  unit_cost: number;
  total_cost: number;
  unit_id?: string;
  unit?: string; // unit abbreviation, e.g. "kg"
  /** Selling-price adjustment decided at order time — carried through to (and still editable
   * on) the goods receipt, applied only once this line is actually received. */
  new_selling_price?: number;
  price_scope?: 'all_stock' | 'new_stock_only';
  /** The item's selling price as of now — context only, shown as "currently X" next to the
   * input; never itself written anywhere. */
  current_selling_price?: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  status: POStatus;
  /** Business date the order was raised, overriding created_at for display/reporting when set. */
  order_date?: string;
  expected_date?: string;
  received_date?: string;
  notes?: string;
  pay_term_days?: number | null;
  additional_shipping_charges?: number;
  line_items: POLineItem[];
  total_amount: number;
  created_by?: string;
  /** Resolved display name for created_by — who raised this purchase order. */
  created_by_name?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePOInput {
  supplier_id: string;
  warehouse_id: string;
  expected_date?: string;
  /** Backdate the order under a business date other than today — "YYYY-MM-DD". */
  order_date?: string;
  notes?: string;
  pay_term_days?: number;
  additional_shipping_charges?: number;
  line_items: {
    item_id: string;
    quantity: number;
    unit_cost: number;
    unit_id?: string;
    new_selling_price?: number;
    price_scope?: 'all_stock' | 'new_stock_only';
  }[];
}

export interface POListParams {
  status?: POStatus;
  search?: string;
  supplier_id?: string;
  warehouse_id?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedPOs { data: PurchaseOrder[]; total: number; page: number; limit: number; hasMore: boolean; }

/** One treasury budget line a purchase draws on, with what is left after this PO. */
export interface POBudgetLine {
  budget_id: string;
  budget_name: string;
  line_name: string;
  planned: number;
  actual: number;
  committed: number;
  available: number;
  requested: number;
  action: 'ok' | 'warn' | 'stop';
}

/** Treasury's verdict on a PO: warn still sends, stop blocks unless an approver overrides. */
export interface POBudgetCheck {
  action: 'ok' | 'warn' | 'stop';
  lines: POBudgetLine[];
}

export interface SendPOResult {
  status: string;
  budget?: POBudgetCheck;
}

export const purchaseOrdersApi = {
  list: (orgSlug: string, params?: POListParams): Promise<PaginatedPOs> =>
    apiClient.get<PaginatedPOs>(`/api/v1/${orgSlug}/inventory/purchase-orders`, params),

  get: (orgSlug: string, id: string) =>
    apiClient.get<PurchaseOrder>(`/api/v1/${orgSlug}/inventory/purchase-orders/${id}`),

  create: (orgSlug: string, data: CreatePOInput) =>
    apiClient.post<PurchaseOrder>(`/api/v1/${orgSlug}/inventory/purchase-orders`, data),

  receive: (orgSlug: string, id: string, receivedItems?: { item_id: string; received_qty: number }[]) =>
    apiClient.put<PurchaseOrder>(`/api/v1/${orgSlug}/inventory/purchase-orders/${id}/receive`, { items: receivedItems }),

  amend: (orgSlug: string, id: string, data: CreatePOInput) =>
    apiClient.put<PurchaseOrder>(`/api/v1/${orgSlug}/inventory/purchase-orders/${id}/amend`, data),

  /**
   * Sends the PO to the supplier. Treasury checks it against the tenant's budgets first: a stop
   * answers 409 OVER_BUDGET, and approvals or procurement managers may resend with overrideBudget.
   */
  send: (orgSlug: string, id: string, overrideBudget = false) =>
    apiClient.put<SendPOResult>(
      `/api/v1/${orgSlug}/inventory/purchase-orders/${id}/send${overrideBudget ? '?override_budget=true' : ''}`,
      {},
    ),

  cancel: (orgSlug: string, id: string) =>
    apiClient.put<PurchaseOrder>(`/api/v1/${orgSlug}/inventory/purchase-orders/${id}/cancel`, {}),
};
