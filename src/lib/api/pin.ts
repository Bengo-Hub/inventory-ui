import { apiClient } from './client';

export interface PinOutlet {
  id: string;         // auth outlet id (X-Outlet-ID)
  name: string;
  code?: string;
  is_default?: boolean;
  use_case?: string;
}

export interface PinLoginResult {
  access_token: string;
  token_type: string;
  user_id: string;
  name?: string;
  email?: string;
  roles?: string[];
  permissions?: string[];
  is_admin?: boolean;
  expires_in: number;
  outlet_id?: string;
  outlet_name?: string;
  outlet_use_case?: string;
}

const base = (orgSlug: string) => `/api/v1/${orgSlug}/inventory/auth/pin`;

export const pinApi = {
  /** Active outlets for the PIN-login outlet picker (public per tenant). */
  outlets: async (orgSlug: string): Promise<PinOutlet[]> => {
    const res = await apiClient.get<{ data: PinOutlet[]; total: number } | PinOutlet[]>(`${base(orgSlug)}/outlets`);
    return Array.isArray(res) ? res : res.data ?? [];
  },

  /** Authenticate by PIN alone at the chosen outlet (staff need not pick their name). */
  identify: (orgSlug: string, pin: string, outletId?: string) =>
    apiClient.post<PinLoginResult>(`${base(orgSlug)}/identify`, { pin, outlet_id: outletId }),
};
