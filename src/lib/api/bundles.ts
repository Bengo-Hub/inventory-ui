import { apiClient } from './client';

export interface BundleComponent {
  id: string;
  component_item_id: string;
  item_name?: string;
  item_sku?: string;
  quantity: number;
  sort_order: number;
}

export interface Bundle {
  id: string;
  tenant_id: string;
  item_id: string;
  item_name?: string;
  name: string;
  is_active: boolean;
  components: BundleComponent[];
}

export interface CreateBundleComponentInput {
  component_item_id: string;
  quantity: number;
}

export interface CreateBundleInput {
  item_id: string;
  name: string;
  is_active?: boolean;
  components: CreateBundleComponentInput[];
}

export type UpdateBundleInput = Partial<CreateBundleInput>;

export interface PaginatedBundles {
  data: Bundle[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

function base(orgSlug: string) {
  return `/api/v1/${orgSlug}/inventory/bundles`;
}

export const bundlesApi = {
  list: (orgSlug: string, params?: { page?: number; limit?: number }): Promise<PaginatedBundles> =>
    apiClient.get<PaginatedBundles>(base(orgSlug), params),

  get: (orgSlug: string, id: string): Promise<Bundle> =>
    apiClient.get<Bundle>(`${base(orgSlug)}/${id}`),

  create: (orgSlug: string, data: CreateBundleInput): Promise<Bundle> =>
    apiClient.post<Bundle>(base(orgSlug), data),

  update: (orgSlug: string, id: string, data: UpdateBundleInput): Promise<Bundle> =>
    apiClient.put<Bundle>(`${base(orgSlug)}/${id}`, data),

  delete: (orgSlug: string, id: string): Promise<void> =>
    apiClient.delete<void>(`${base(orgSlug)}/${id}`),
};
