import { apiClient } from './client';

/** A tax code sourced + cached from treasury-api (the platform source of truth). */
export interface TaxCode {
  code: string;
  name: string;
  rate: number;
  tax_type: string;
  is_default: boolean;
}

export const taxesApi = {
  list: async (orgSlug: string): Promise<TaxCode[]> => {
    const res = await apiClient.get<{ tax_codes: TaxCode[]; total: number } | TaxCode[]>(
      `/api/v1/${orgSlug}/inventory/taxes`,
    );
    return Array.isArray(res) ? res : res.tax_codes ?? [];
  },
};
