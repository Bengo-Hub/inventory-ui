import { apiClient } from './client';

export type ReturnPaymentStatus = 'pending' | 'due' | 'partial' | 'paid';

export interface PurchaseReturn {
  id: string;
  return_number: string;
  purchase_order_id?: string | null;
  supplier_id?: string | null;
  reason: string;
  return_amount: number;
  payment_status: ReturnPaymentStatus;
  date_returned: string;
}

export interface PurchaseReturnLineInput {
  item_id: string;
  quantity: number;
  sub_total: number;
}

export interface CreatePurchaseReturnInput {
  purchase_order_id?: string;
  supplier_id?: string;
  reason?: string;
  lines: PurchaseReturnLineInput[];
}

export interface ReturnListParams {
  payment_status?: ReturnPaymentStatus;
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
