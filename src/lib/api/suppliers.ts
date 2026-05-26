import { apiClient } from './client';

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
