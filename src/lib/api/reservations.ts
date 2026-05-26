import { apiClient } from './client';

export type ReservationStatus = 'active' | 'consumed' | 'released' | 'expired';

export interface Reservation {
  id: string;
  order_id: string;
  item_id: string;
  item_name?: string;
  item_sku?: string;
  warehouse_id: string;
  quantity: number;
  status: ReservationStatus;
  expires_at?: string;
  created_at: string;
}

export interface ReservationListParams {
  order_id?: string;
  item_id?: string;
  status?: ReservationStatus;
}

export const reservationsApi = {
  list: (orgSlug: string, params?: ReservationListParams) =>
    apiClient.get<Reservation[]>(`/api/v1/${orgSlug}/inventory/reservations`, params),

  get: (orgSlug: string, id: string) =>
    apiClient.get<Reservation>(`/api/v1/${orgSlug}/inventory/reservations/${id}`),
};
