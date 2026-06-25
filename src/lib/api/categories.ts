import { apiClient } from './client';

export interface Category {
  id: string;
  name: string;
  code?: string;
  description?: string;
  icon?: string;
  parent_id?: string | null;
  parent_name?: string | null;
  is_active: boolean;
}

export interface CategoryPayload {
  name: string;
  code?: string;
  description?: string;
  parent_id?: string | null;
}

export const categoriesApi = {
  // Pass { hasItems: true } to return only categories that have at least one item
  // linked to them — used by selection surfaces (e.g. label printing) so picking a
  // category can never produce an empty selection.
  list: async (orgSlug: string, opts?: { hasItems?: boolean }): Promise<Category[]> => {
    const params = opts?.hasItems ? { has_items: true } : undefined;
    const res = await apiClient.get<{ data: Category[]; total: number } | Category[]>(`/api/v1/${orgSlug}/inventory/categories`, params);
    return Array.isArray(res) ? res : (res as { data: Category[] }).data ?? [];
  },

  create: (orgSlug: string, data: CategoryPayload) =>
    apiClient.post<Category>(`/api/v1/${orgSlug}/inventory/categories`, data),

  update: (orgSlug: string, id: string, data: CategoryPayload) =>
    apiClient.put<Category>(`/api/v1/${orgSlug}/inventory/categories/${id}`, data),

  delete: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/categories/${id}`),
};
