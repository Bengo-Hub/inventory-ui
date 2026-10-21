import { apiClient } from './client';

export type ReturnPaymentStatus = 'pending' | 'due' | 'partial' | 'paid';

/** Where the goods go: back to the supplier (credited) or to a repair provider (expected back). */
export type ReturnDestination = 'supplier' | 'service';

/** Repair lifecycle of a destination=service return. Unset until the order is approved. */
export type ServiceStatus = 'out' | 'partial' | 'returned' | 'written_off';

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
  /** Repair orders: units back in stock, units written off, units still at the provider. */
  received_back_qty: number;
  written_off_qty: number;
  outstanding_qty: number;
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
  destination: ReturnDestination;
  service_status?: ServiceStatus;
  service_provider?: string;
  service_contact?: string;
  fault?: string;
  /** Calendar day (YYYY-MM-DD) the provider is expected to return the goods. */
  expected_back_date?: string;
  /** Units of a repair order still at the provider (0 for supplier returns). */
  outstanding_quantity: number;
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
  /** Defaults to 'supplier'. */
  destination?: ReturnDestination;
  purchase_order_id?: string;
  supplier_id?: string;
  warehouse_id?: string;
  reason?: string;
  date_returned?: string;
  /** Service orders only. The provider is free text (technician, care centre). */
  service_provider?: string;
  service_contact?: string;
  fault?: string;
  expected_back_date?: string;
  lines: PurchaseReturnLineInput[];
}

export interface ReceiveServiceLineInput {
  line_id: string;
  returned_qty: number;
  written_off_qty: number;
}

export interface ReceiveServiceInput {
  /** Backdate the movement (YYYY-MM-DD); blank means now. */
  date?: string;
  /** Where the goods are put back; blank means the location they left from. */
  warehouse_id?: string;
  notes?: string;
  lines: ReceiveServiceLineInput[];
}

export interface ReturnListParams {
  payment_status?: ReturnPaymentStatus;
  destination?: ReturnDestination;
  /** Comma separated: out,partial,returned,written_off. */
  service_status?: string;
  overdue?: boolean;
  /** The caller's local day (YYYY-MM-DD); decides what is overdue. */
  today?: string;
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

export interface ServiceSummary {
  open_orders: number;
  units_outstanding: number;
  cost_outstanding: number;
  overdue_orders: number;
  overdue_units: number;
  providers: { provider: string; orders: number; units: number }[];
  /** True when more open orders exist than the summary scans. */
  truncated: boolean;
}

export interface ServiceSummaryParams {
  outlet_id?: string;
  warehouse_id?: string;
  today?: string;
}

const base = (org: string) => `/api/v1/${org}/inventory/purchase-returns`;

export const purchaseReturnsApi = {
  list: (org: string, params?: ReturnListParams): Promise<PaginatedReturns> => apiClient.get<PaginatedReturns>(base(org), params),
  get: (org: string, id: string) => apiClient.get<PurchaseReturn>(`${base(org)}/${id}`),
  create: (org: string, data: CreatePurchaseReturnInput) => apiClient.post<PurchaseReturn>(base(org), data),
  approve: (org: string, id: string) => apiClient.post<PurchaseReturn>(`${base(org)}/${id}/approve`, {}),
  /** Receive repaired goods back (and write off the unrepairable units) on a service order. */
  receive: (org: string, id: string, data: ReceiveServiceInput) => apiClient.post<PurchaseReturn>(`${base(org)}/${id}/receive`, data),
  serviceSummary: (org: string, params?: ServiceSummaryParams) => apiClient.get<ServiceSummary>(`${base(org)}/service-summary`, params),
};
