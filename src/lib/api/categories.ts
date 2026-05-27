import { apiClient } from './client';

export interface Category {
  id: string;
  name: string;
  code?: string;
  description?: string;
  icon?: string;
  is_active: boolean;
}

export const categoriesApi = {
  list: async (orgSlug: string): Promise<Category[]> => {
    const res = await apiClient.get<{ data: Category[]; total: number } | Category[]>(`/api/v1/${orgSlug}/inventory/categories`);
    return Array.isArray(res) ? res : (res as { data: Category[] }).data ?? [];
  },

  delete: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/categories/${id}`),
};
