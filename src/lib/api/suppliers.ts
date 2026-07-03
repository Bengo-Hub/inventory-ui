import { apiClient } from './client';

export type PaymentMethodType = 'mpesa' | 'mpesa_b2b' | 'bank_transfer' | 'cash' | 'cheque' | '';

export interface Supplier {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_person?: string;
  tax_number?: string;
  notes?: string;
  is_active: boolean;
  // Payment config
  payment_method_type?: PaymentMethodType;
  mpesa_phone?: string;
  mpesa_business_name?: string;
  // B2B M-Pesa fields (for supplier payments to a paybill or till)
  mpesa_shortcode?: string;      // Recipient paybill or till number
  mpesa_account_ref?: string;    // Account reference at recipient paybill
  mpesa_shortcode_type?: 'paybill' | 'till'; // Determines CommandID: BusinessPayBill vs BusinessBuyGoods
  bank_account_number?: string;
  bank_name?: string;
  bank_branch?: string;
  tax_pin?: string;
  requires_invoice_before_payment?: boolean;
  auto_pay_enabled?: boolean;
  auto_pay_max_amount?: number;    // POs above this amount require manual approval (0 = no limit)
  payment_terms_days?: number;
  credit_limit?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSupplierInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contact_person?: string;
  tax_number?: string;
  notes?: string;
  // Payment config
  payment_method_type?: PaymentMethodType;
  mpesa_phone?: string;
  mpesa_business_name?: string;
  mpesa_shortcode?: string;
  mpesa_account_ref?: string;
  mpesa_shortcode_type?: 'paybill' | 'till';
  bank_account_number?: string;
  bank_name?: string;
  bank_branch?: string;
  tax_pin?: string;
  requires_invoice_before_payment?: boolean;
  auto_pay_enabled?: boolean;
  auto_pay_max_amount?: number;
  payment_terms_days?: number;
  credit_limit?: number;
}

export type UpdateSupplierInput = Partial<CreateSupplierInput>;

export interface SupplierListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedSuppliers {
  data: Supplier[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export const suppliersApi = {
  list: (orgSlug: string, params?: SupplierListParams): Promise<PaginatedSuppliers> =>
    apiClient.get<PaginatedSuppliers>(`/api/v1/${orgSlug}/inventory/suppliers`, params),

  get: (orgSlug: string, id: string) =>
    apiClient.get<Supplier>(`/api/v1/${orgSlug}/inventory/suppliers/${id}`),

  create: (orgSlug: string, data: CreateSupplierInput) =>
    apiClient.post<Supplier>(`/api/v1/${orgSlug}/inventory/suppliers`, data),

  update: (orgSlug: string, id: string, data: UpdateSupplierInput) =>
    apiClient.put<Supplier>(`/api/v1/${orgSlug}/inventory/suppliers/${id}`, data),

  delete: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/suppliers/${id}`),
};
