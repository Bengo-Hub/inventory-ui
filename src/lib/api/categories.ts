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
  list: async (orgSlug: string): Promise<Category[]> => {
    const res = await apiClient.get<{ data: Category[]; total: number } | Category[]>(`/api/v1/${orgSlug}/inventory/categories`);
    return Array.isArray(res) ? res : (res as { data: Category[] }).data ?? [];
  },

  create: (orgSlug: string, data: CategoryPayload) =>
    apiClient.post<Category>(`/api/v1/${orgSlug}/inventory/categories`, data),

  update: (orgSlug: string, id: string, data: CategoryPayload) =>
    apiClient.put<Category>(`/api/v1/${orgSlug}/inventory/categories/${id}`, data),

  delete: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/categories/${id}`),
};
