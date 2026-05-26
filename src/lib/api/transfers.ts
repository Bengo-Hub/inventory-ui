import { apiClient } from './client';

export type TransferStatus = 'draft' | 'pending' | 'in_transit' | 'received' | 'cancelled';

export interface TransferItem {
  id: string;
  item_id: string;
  item_name?: string;
  item_sku?: string;
  quantity: number;
  received_qty?: number;
}

export interface Transfer {
  id: string;
  reference: string;
  from_warehouse_id: string;
  from_warehouse_name?: string;
  to_warehouse_id: string;
  to_warehouse_name?: string;
  status: TransferStatus;
  note?: string;
  items: TransferItem[];
  created_at: string;
  updated_at: string;
}

export interface CreateTransferInput {
  from_warehouse_id: string;
  to_warehouse_id: string;
  note?: string;
  items: { item_id: string; quantity: number }[];
}

export interface TransferListParams {
  status?: TransferStatus;
  warehouse_id?: string;
  page?: number;
  limit?: number;
}

export const transfersApi = {
  list: (orgSlug: string, params?: TransferListParams) =>
    apiClient.get<Transfer[]>(`/api/v1/${orgSlug}/inventory/transfers`, params),

  get: (orgSlug: string, id: string) =>
    apiClient.get<Transfer>(`/api/v1/${orgSlug}/inventory/transfers/${id}`),

  create: (orgSlug: string, data: CreateTransferInput) =>
    apiClient.post<Transfer>(`/api/v1/${orgSlug}/inventory/transfers`, data),

  ship: (orgSlug: string, id: string) =>
    apiClient.post<Transfer>(`/api/v1/${orgSlug}/inventory/transfers/${id}/ship`, {}),

  receive: (orgSlug: string, id: string, receivedItems?: { item_id: string; received_qty: number }[]) =>
    apiClient.post<Transfer>(`/api/v1/${orgSlug}/inventory/transfers/${id}/receive`, { items: receivedItems }),

  cancel: (orgSlug: string, id: string) =>
    apiClient.post<Transfer>(`/api/v1/${orgSlug}/inventory/transfers/${id}/cancel`, {}),
};
