import { apiClient } from './client';

export interface Category {
  id: string;
  name: string;
  description?: string;
  parent_id?: string;
  item_count?: number;
  created_at: string;
}

export const categoriesApi = {
  list: (orgSlug: string) =>
    apiClient.get<Category[]>(`/api/v1/${orgSlug}/inventory/categories`),

  delete: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/categories/${id}`),
};
