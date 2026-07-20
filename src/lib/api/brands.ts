import { apiClient } from './client';

/**
 * Brands API — tenant-scoped ItemBrand master (e.g. HP, Samsung, Coca-Cola).
 * Mirrors inventory-api internal/http/handlers/brand.go. Items reference a brand
 * via brand_id; the Brands picker on the GOODS item form is backed by these.
 */
export interface Brand {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  description?: string;
  logo_url?: string;
  is_active: boolean;
  sort_order: number;
}

export interface BrandPayload {
  name: string;
  code?: string;
  description?: string;
  logo_url?: string;
  sort_order?: number;
}

const base = (orgSlug: string) => `/api/v1/${orgSlug}/inventory/brands`;

export const brandsApi = {
  list: async (orgSlug: string): Promise<Brand[]> => {
    const res = await apiClient.get<{ data: Brand[]; total: number } | Brand[]>(base(orgSlug));
    return Array.isArray(res) ? res : (res as { data: Brand[] }).data ?? [];
  },

  create: (orgSlug: string, data: BrandPayload) =>
    apiClient.post<Brand>(base(orgSlug), data),

  update: (orgSlug: string, id: string, data: BrandPayload) =>
    apiClient.put<Brand>(`${base(orgSlug)}/${id}`, data),

  delete: (orgSlug: string, id: string) =>
    apiClient.delete<{ status: string }>(`${base(orgSlug)}/${id}`),
};
