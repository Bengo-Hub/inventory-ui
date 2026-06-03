import { apiClient } from './client';

export type RequisitionStatus =
  | 'draft' | 'submitted' | 'procurement_review' | 'approved' | 'rejected' | 'ordered' | 'completed';
export type RequestType = 'inventory' | 'external_item' | 'service';
export type Priority = 'low' | 'medium' | 'high' | 'critical';

export interface RequisitionLine {
  id?: string;
  item_type: 'inventory' | 'external' | 'service';
  item_id?: string | null;
  quantity: number;
  estimated_price?: number | null;
  description?: string;
  supplier_id?: string | null;
  urgent?: boolean;
}

export interface Requisition {
  id: string;
  reference_number: string;
  request_type: RequestType;
  purpose: string;
  priority: Priority;
  status: RequisitionStatus;
  notes?: string;
  outlet_id?: string | null;
  required_by_date?: string | null;
  lines?: RequisitionLine[];
  created_at: string;
}

export interface CreateRequisitionInput {
  request_type: RequestType;
  purpose: string;
  priority: Priority;
  required_by_date?: string | null;
  notes?: string;
  lines: RequisitionLine[];
}

export interface RequisitionListParams {
  status?: RequisitionStatus;
  request_type?: RequestType;
  page?: number;
  limit?: number;
}

export interface PaginatedRequisitions {
  data: Requisition[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ConvertToPOInput {
  supplier_id: string;
  warehouse_id: string;
  currency?: string;
}

const base = (org: string) => `/api/v1/${org}/inventory/requisitions`;

export const requisitionsApi = {
  list: (org: string, params?: RequisitionListParams): Promise<PaginatedRequisitions> =>
    apiClient.get<PaginatedRequisitions>(base(org), params),
  get: (org: string, id: string) => apiClient.get<Requisition>(`${base(org)}/${id}`),
  create: (org: string, data: CreateRequisitionInput) => apiClient.post<Requisition>(base(org), data),
  submit: (org: string, id: string) => apiClient.post<Requisition>(`${base(org)}/${id}/submit`, {}),
  review: (org: string, id: string) => apiClient.post<Requisition>(`${base(org)}/${id}/review`, {}),
  approve: (org: string, id: string) => apiClient.post<Requisition>(`${base(org)}/${id}/approve`, {}),
  reject: (org: string, id: string) => apiClient.post<Requisition>(`${base(org)}/${id}/reject`, {}),
  convertToPO: (org: string, id: string, data: ConvertToPOInput) =>
    apiClient.post<{ purchase_order_id: string; po_number: string; total_amount: number }>(
      `${base(org)}/${id}/convert-to-po`, data),
};
