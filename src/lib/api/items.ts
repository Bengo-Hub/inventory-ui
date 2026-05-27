import { apiClient } from './client';

export interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string;
  type: 'GOODS' | 'SERVICE' | 'RECIPE' | 'INGREDIENT' | 'VOUCHER' | 'EQUIPMENT';
  category_id?: string;
  category_name?: string;
  unit_id?: string;
  is_active: boolean;
  image_url?: string;
  barcode?: string;
  barcode_type?: string;
  requires_age_verification: boolean;
  is_perishable: boolean;
  track_lots: boolean;
  track_serial_numbers: boolean;
  weight_kg?: number;
  reorder_level?: number;
  reorder_quantity?: number;
  tags?: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateItemInput {
  sku?: string;
  name: string;
  description?: string;
  type: string;
  category_id?: string;
  unit_id?: string;
  barcode?: string;
  reorder_level?: number;
  reorder_quantity?: number;
  requires_age_verification?: boolean;
  is_perishable?: boolean;
  track_lots?: boolean;
  track_serial_numbers?: boolean;
  initial_quantity?: number;
  tags?: string[];
}

export type UpdateItemInput = Partial<CreateItemInput>;

function itemsBase(orgSlug: string) {
  return `/api/v1/${orgSlug}/inventory/items`;
}

export const itemsApi = {
  list: async (orgSlug: string, params?: { type?: string; search?: string }): Promise<Item[]> => {
    const res = await apiClient.get<{ data: Item[]; total: number } | Item[]>(itemsBase(orgSlug), params);
    return Array.isArray(res) ? res : (res as { data: Item[] }).data ?? [];
  },

  get: (orgSlug: string, sku: string) =>
    apiClient.get<Item>(`${itemsBase(orgSlug)}/${sku}`),

  create: (orgSlug: string, data: CreateItemInput) =>
    apiClient.post<Item>(itemsBase(orgSlug), data),

  update: (orgSlug: string, sku: string, data: UpdateItemInput) =>
    apiClient.put<Item>(`${itemsBase(orgSlug)}/${sku}`, data),

  delete: (orgSlug: string, sku: string) =>
    apiClient.delete<void>(`${itemsBase(orgSlug)}/${sku}`),

  import: (orgSlug: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<{ created: number; updated: number; failed: number; errors?: string[] }>(
      `${itemsBase(orgSlug)}/import`,
      form,
    );
  },
};
