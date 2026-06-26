import { apiClient } from './client';

export type RFQStatus = 'draft' | 'sent' | 'closed' | 'awarded' | 'cancelled';
export type RFQResponseStatus = 'invited' | 'submitted' | 'declined';

export interface RFQLine {
  id: string;
  item_id?: string;
  item_name?: string;
  description: string;
  quantity: number;
  uom?: string;
}

export interface QuotedItem {
  rfq_line_id: string;
  unit_price: number;
  lead_time_days: number;
  available: boolean;
  notes?: string;
}

export interface SupplierResponse {
  id: string;
  supplier_id: string;
  supplier_name?: string;
  status: RFQResponseStatus;
  currency: string;
  notes?: string;
  submitted_at?: string;
  quoted_items: QuotedItem[];
  total: number;
}

export interface RFQAward {
  id: string;
  rfq_line_id: string;
  supplier_id: string;
  supplier_name?: string;
  unit_price: number;
  quantity: number;
  po_id?: string;
}

export interface RFQ {
  id: string;
  rfq_number: string;
  title: string;
  status: RFQStatus;
  requisition_id?: string;
  warehouse_id?: string;
  notes?: string;
  due_date?: string;
  created_at: string;
  lines?: RFQLine[];
  responses?: SupplierResponse[];
  awards?: RFQAward[];
}

export interface RFQLineInput {
  item_id?: string | null;
  description?: string;
  quantity: number;
  uom?: string;
}

export interface CreateRFQInput {
  title?: string;
  requisition_id?: string | null;
  /** Links the RFQ (and the awarded PO/contract) to a project for cost attribution. */
  project_id?: string;
  warehouse_id?: string | null;
  notes?: string;
  due_date?: string | null;
  lines: RFQLineInput[];
}

export interface ComparisonQuote {
  supplier_id: string;
  supplier_name: string;
  response_id: string;
  unit_price: number;
  lead_time_days: number;
  available: boolean;
  line_total: number;
}

export interface ComparisonLine {
  rfq_line_id: string;
  description: string;
  item_name?: string;
  quantity: number;
  best_supplier_id?: string;
  quotes: ComparisonQuote[];
}

export interface ComparisonSupplier {
  supplier_id: string;
  supplier_name: string;
  response_id: string;
  status: RFQResponseStatus;
  currency: string;
  grand_total: number;
}

export interface RFQComparison {
  lines: ComparisonLine[];
  suppliers: ComparisonSupplier[];
}

export interface AwardEntry {
  rfq_line_id: string;
  supplier_id: string;
  unit_price: number;
  quantity: number;
}

export interface QuoteInput {
  currency?: string;
  notes?: string;
  items: { rfq_line_id: string; unit_price: number; lead_time_days?: number; available: boolean; notes?: string }[];
}

const base = (orgSlug: string) => `/api/v1/${orgSlug}/inventory`;

export const rfqApi = {
  list: (orgSlug: string, status?: RFQStatus) =>
    apiClient.get<RFQ[]>(`${base(orgSlug)}/rfqs`, status ? { status } : undefined),
  get: (orgSlug: string, id: string) => apiClient.get<RFQ>(`${base(orgSlug)}/rfqs/${id}`),
  create: (orgSlug: string, data: CreateRFQInput) => apiClient.post<RFQ>(`${base(orgSlug)}/rfqs`, data),
  update: (orgSlug: string, id: string, data: CreateRFQInput) => apiClient.put<RFQ>(`${base(orgSlug)}/rfqs/${id}`, data),
  remove: (orgSlug: string, id: string) => apiClient.delete<{ deleted: boolean }>(`${base(orgSlug)}/rfqs/${id}`),

  invite: (orgSlug: string, id: string, supplierIds: string[]) =>
    apiClient.post<{ invited: number; rfq: RFQ }>(`${base(orgSlug)}/rfqs/${id}/suppliers`, { supplier_ids: supplierIds }),
  removeSupplier: (orgSlug: string, id: string, responseId: string) =>
    apiClient.delete<{ removed: boolean }>(`${base(orgSlug)}/rfqs/${id}/responses/${responseId}`),
  send: (orgSlug: string, id: string) => apiClient.post<RFQ>(`${base(orgSlug)}/rfqs/${id}/send`, {}),
  quote: (orgSlug: string, id: string, responseId: string, data: QuoteInput) =>
    apiClient.put<RFQ>(`${base(orgSlug)}/rfqs/${id}/responses/${responseId}/quote`, data),
  decline: (orgSlug: string, id: string, responseId: string) =>
    apiClient.post<RFQ>(`${base(orgSlug)}/rfqs/${id}/responses/${responseId}/decline`, {}),
  comparison: (orgSlug: string, id: string) => apiClient.get<RFQComparison>(`${base(orgSlug)}/rfqs/${id}/comparison`),
  award: (orgSlug: string, id: string, awards: AwardEntry[]) =>
    apiClient.post<RFQ>(`${base(orgSlug)}/rfqs/${id}/award`, { awards }),
  convertToPOs: (orgSlug: string, id: string, warehouseId?: string) =>
    apiClient.post<{ purchase_orders: { po_number: string }[]; count: number }>(
      `${base(orgSlug)}/rfqs/${id}/convert-to-po`,
      { warehouse_id: warehouseId ?? null },
    ),
};
