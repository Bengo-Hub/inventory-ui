import { apiClient } from './client';

export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  type?: string;
  is_base: boolean;
  base_unit_id?: string;
  conversion_factor?: number;
  created_at: string;
}

export interface CreateUnitInput {
  name: string;
  abbreviation: string;
  type?: string;
  is_base?: boolean;
  base_unit_id?: string;
  conversion_factor?: number;
}

export const unitsApi = {
  list: (orgSlug: string) =>
    apiClient.get<Unit[]>(`/api/v1/${orgSlug}/inventory/units`),

  create: (orgSlug: string, data: CreateUnitInput) =>
    apiClient.post<Unit>(`/api/v1/${orgSlug}/inventory/units`, data),

  delete: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/units/${id}`),
};
