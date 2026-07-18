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
  /** Outlet use_cases this category is relevant to; empty/absent = universal. */
  use_cases?: string[];
}

export interface CategoryPayload {
  name: string;
  code?: string;
  description?: string;
  parent_id?: string | null;
  /** Stamped from the creating outlet's use_case so food categories never
   *  pollute a pharmacy outlet's pickers (and vice versa). */
  use_cases?: string[];
}

export const categoriesApi = {
  // Pass { hasItems: true } to return only categories that have at least one item
  // linked to them — used by selection surfaces (e.g. label printing) so picking a
  // category can never produce an empty selection.
  // useCase scopes the list to the outlet's vertical: untagged categories are
  // universal, tagged ones only surface for their use_cases (global rows included).
  list: async (orgSlug: string, opts?: { hasItems?: boolean; useCase?: string | null }): Promise<Category[]> => {
    const params: Record<string, string | boolean> = {};
    if (opts?.hasItems) params.has_items = true;
    if (opts?.useCase) params.use_case = opts.useCase;
    const res = await apiClient.get<{ data: Category[]; total: number } | Category[]>(
      `/api/v1/${orgSlug}/inventory/categories`,
      Object.keys(params).length > 0 ? params : undefined,
    );
    return Array.isArray(res) ? res : (res as { data: Category[] }).data ?? [];
  },

  create: (orgSlug: string, data: CategoryPayload) =>
    apiClient.post<Category>(`/api/v1/${orgSlug}/inventory/categories`, data),

  update: (orgSlug: string, id: string, data: CategoryPayload) =>
    apiClient.put<Category>(`/api/v1/${orgSlug}/inventory/categories/${id}`, data),

  delete: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/categories/${id}`),
};
