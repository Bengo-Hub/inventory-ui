import { apiClient } from './client';

export type ReservationStatus = 'pending' | 'confirmed' | 'consumed' | 'released';

export interface ReservedItem {
  sku: string;
  requested_qty: number;
  reserved_qty: number;
  available_qty: number;
  is_fully_reserved: boolean;
}

// One row per Reservation (a single order's hold, possibly across several items) — matches
// stock.ReservationSummary (inventory-api), not the ordering-backend/pos-api cross-service
// ReservationResponse contract (that one has no warehouse_name/item_count/total_quantity).
export interface Reservation {
  id: string;
  order_id: string;
  warehouse_id?: string;
  warehouse_name?: string;
  status: ReservationStatus;
  items: ReservedItem[];
  item_count: number;
  total_quantity: number;
  expires_at?: string;
  confirmed_at?: string;
  created_at: string;
}

export interface ReservationListParams {
  status?: string;
  // The list has no free-text field to search (items only carry a SKU, no name — see the
  // backend's ReservationListFilter doc comment) — a UUID-shaped value is treated as an
  // order_id lookup, same as passing order_id directly.
  search?: string;
  page?: number;
  limit?: number;
}

export interface ReservationListResult {
  data: Reservation[];
  total: number;
}

export const reservationsApi = {
  list: async (orgSlug: string, params?: ReservationListParams): Promise<ReservationListResult> => {
    const res = await apiClient.get<{ data: Reservation[]; total: number } | Reservation[]>(
      `/api/v1/${orgSlug}/inventory/reservations`, params,
    );
    return Array.isArray(res) ? { data: res, total: res.length } : { data: res.data ?? [], total: res.total ?? 0 };
  },

  get: (orgSlug: string, id: string) =>
    apiClient.get<Reservation>(`/api/v1/${orgSlug}/inventory/reservations/${id}`),
};
