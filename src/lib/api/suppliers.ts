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
  bank_account_number?: string;
  bank_name?: string;
  bank_branch?: string;
  tax_pin?: string;
  requires_invoice_before_payment?: boolean;
  auto_pay_enabled?: boolean;
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
  bank_account_number?: string;
  bank_name?: string;
  bank_branch?: string;
  tax_pin?: string;
  requires_invoice_before_payment?: boolean;
  auto_pay_enabled?: boolean;
  payment_terms_days?: number;
  credit_limit?: number;
}

export type UpdateSupplierInput = Partial<CreateSupplierInput>;

export interface SupplierListParams {
  search?: string;
  page?: number;
  limit?: number;
}

export const suppliersApi = {
  list: (orgSlug: string, params?: SupplierListParams) =>
    apiClient.get<Supplier[]>(`/api/v1/${orgSlug}/inventory/suppliers`, params),

  get: (orgSlug: string, id: string) =>
    apiClient.get<Supplier>(`/api/v1/${orgSlug}/inventory/suppliers/${id}`),

  create: (orgSlug: string, data: CreateSupplierInput) =>
    apiClient.post<Supplier>(`/api/v1/${orgSlug}/inventory/suppliers`, data),

  update: (orgSlug: string, id: string, data: UpdateSupplierInput) =>
    apiClient.put<Supplier>(`/api/v1/${orgSlug}/inventory/suppliers/${id}`, data),

  delete: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/suppliers/${id}`),
};
