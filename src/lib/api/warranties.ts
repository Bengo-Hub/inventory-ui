import { apiClient } from './client';

/**
 * Warranties API — warranty tracking for serialized items (retail tier 2+).
 * Mirrors inventory-api internal/http/handlers/extras_warranties.go.
 * Note: the persisted void status string is "voided"; an active row whose
 * coverage window has lapsed is surfaced by the API as "expired".
 */
export type WarrantyStatus = 'active' | 'claimed' | 'voided' | 'expired';

export interface Warranty {
  id: string;
  item_id: string;
  item_name: string;
  item_sku: string;
  serial_number: string;
  customer_id?: string;
  purchase_date: string;
  warranty_start: string;
  warranty_end: string;
  status: WarrantyStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/** Matches the backend's warrantyWriteRequest (create + update share the shape). */
export interface WarrantyWriteInput {
  item_id?: string;
  serial_number?: string;
  customer_id?: string;
  purchase_date?: string;
  warranty_start?: string;
  warranty_end?: string;
  /** Months of coverage from warranty_start when warranty_end is omitted (default 12). */
  coverage_months?: number;
  notes?: string;
}

export interface WarrantyListParams {
  status?: WarrantyStatus;
  item_id?: string;
  search?: string;
}

const base = (org: string) => `/api/v1/${org}/inventory/warranties`;

export const warrantiesApi = {
  list: (org: string, params?: WarrantyListParams): Promise<Warranty[]> =>
    apiClient.get<Warranty[]>(base(org), params),
  lookup: (org: string, serial: string): Promise<Warranty[]> =>
    apiClient.get<Warranty[]>(`${base(org)}/lookup`, { serial }),
  get: (org: string, id: string) => apiClient.get<Warranty>(`${base(org)}/${id}`),
  create: (org: string, data: WarrantyWriteInput) => apiClient.post<Warranty>(base(org), data),
  update: (org: string, id: string, data: WarrantyWriteInput) =>
    apiClient.put<Warranty>(`${base(org)}/${id}`, data),
  claim: (org: string, id: string, notes?: string) =>
    apiClient.post<Warranty>(`${base(org)}/${id}/claim`, notes ? { notes } : {}),
  void: (org: string, id: string, notes?: string) =>
    apiClient.post<Warranty>(`${base(org)}/${id}/void`, notes ? { notes } : {}),
  remove: (org: string, id: string) => apiClient.delete<{ deleted: boolean }>(`${base(org)}/${id}`),
};
