import { apiClient } from './client';

export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  type?: string;
  /** Outlet use_cases this unit is relevant to; empty/absent = universal. */
  use_cases?: string[];
  item_count?: number;
  is_base: boolean;
  base_unit_id?: string;
  conversion_factor?: number;
  created_at: string;
}

export interface CreateUnitInput {
  name: string;
  abbreviation: string;
  type?: string;
  /** Stamped from the creating outlet's use_case so vertical-specific units
   *  (tot, pot, portion) never pollute other verticals' pickers. */
  use_cases?: string[];
  is_base?: boolean;
  base_unit_id?: string;
  conversion_factor?: number;
}

export const unitsApi = {
  // useCase scopes the global unit table to the outlet's vertical: untagged units
  // are universal, tagged ones only surface for their use_cases.
  list: (orgSlug: string, useCase?: string | null) =>
    apiClient.get<Unit[]>(
      `/api/v1/${orgSlug}/inventory/units`,
      useCase ? { use_case: useCase } : undefined,
    ),

  create: (orgSlug: string, data: CreateUnitInput) =>
    apiClient.post<Unit>(`/api/v1/${orgSlug}/inventory/units`, data),

  delete: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/units/${id}`),
};
