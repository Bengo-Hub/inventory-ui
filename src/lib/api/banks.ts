import { apiClient } from './client';

/** Bank list + account verification, proxied by inventory-api to the treasury S2S Paystack
 *  endpoints — one source of truth so supplier bank details are verified before saving. */

export interface BankOption {
  code: string;
  name: string;
}

export const banksApi = {
  list: (orgSlug: string, country = 'kenya') =>
    apiClient.get<Record<string, unknown>>(`/api/v1/${orgSlug}/inventory/banks/${country}`),
  resolve: (orgSlug: string, accountNumber: string, bankCode: string) =>
    apiClient.get<Record<string, unknown>>(`/api/v1/${orgSlug}/inventory/banks/resolve`, {
      account_number: accountNumber,
      bank_code: bankCode,
    }),
};
