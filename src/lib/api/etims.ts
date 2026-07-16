import { apiClient } from './client';

/** One KRA eTIMS code-list entry (proxied + cached from treasury-api). */
export interface EtimsCode {
  code_type: string;
  code: string;
  name: string;
  code_detail?: string;
}

/**
 * KRA eTIMS code lists for catalog form dropdowns (item classification, packaging unit,
 * quantity unit). Proxied via inventory-api → treasury S2S; empty until a device operator
 * syncs the lists from KRA (Treasury → eTIMS Devices → Refresh Code Lists).
 */
export const etimsApi = {
  codeLists: async (orgSlug: string, type: string, q?: string, limit?: number): Promise<EtimsCode[]> => {
    const qs = new URLSearchParams({ type });
    if (q) qs.set('q', q);
    if (limit) qs.set('limit', String(limit));
    const res = await apiClient.get<{ codes: EtimsCode[]; total: number }>(
      `/api/v1/${orgSlug}/inventory/etims/code-lists?${qs}`,
    );
    return res.codes ?? [];
  },
};
