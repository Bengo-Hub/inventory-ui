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
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string;
  warehouse_id: string;
  warehouse_name?: string;
  status: POStatus;
  order_date: string;
  expected_date?: string;
  received_date?: string;
  notes?: string;
  pay_term_days?: number | null;
  additional_shipping_charges?: number;
  line_items: POLineItem[];
  total_amount: number;
  created_at: string;
  updated_at: string;
}

export interface CreatePOInput {
  supplier_id: string;
  warehouse_id: string;
  expected_date?: string;
  notes?: string;
  pay_term_days?: number;
  additional_shipping_charges?: number;
  line_items: { item_id: string; quantity: number; unit_cost: number }[];
}

export interface POListParams {
  status?: POStatus;
  supplier_id?: string;
  warehouse_id?: string;
  page?: number;
  limit?: number;
}

export const purchaseOrdersApi = {
  list: (orgSlug: string, params?: POListParams) =>
    apiClient.get<PurchaseOrder[]>(`/api/v1/${orgSlug}/inventory/purchase-orders`, params),

  get: (orgSlug: string, id: string) =>
    apiClient.get<PurchaseOrder>(`/api/v1/${orgSlug}/inventory/purchase-orders/${id}`),

  create: (orgSlug: string, data: CreatePOInput) =>
    apiClient.post<PurchaseOrder>(`/api/v1/${orgSlug}/inventory/purchase-orders`, data),

  receive: (orgSlug: string, id: string, receivedItems?: { item_id: string; received_qty: number }[]) =>
    apiClient.put<PurchaseOrder>(`/api/v1/${orgSlug}/inventory/purchase-orders/${id}/receive`, { items: receivedItems }),

  amend: (orgSlug: string, id: string, data: CreatePOInput) =>
    apiClient.put<PurchaseOrder>(`/api/v1/${orgSlug}/inventory/purchase-orders/${id}/amend`, data),

  send: (orgSlug: string, id: string) =>
    apiClient.put<PurchaseOrder>(`/api/v1/${orgSlug}/inventory/purchase-orders/${id}/send`, {}),

  cancel: (orgSlug: string, id: string) =>
    apiClient.put<PurchaseOrder>(`/api/v1/${orgSlug}/inventory/purchase-orders/${id}/cancel`, {}),
};
