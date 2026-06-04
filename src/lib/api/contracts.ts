import { apiClient } from './client';

export type ContractStatus = 'draft' | 'active' | 'expired' | 'terminated';

export interface Contract {
  id: string;
  supplier_id: string;
  title: string;
  start_date: string;
  end_date: string;
  value: number;
  status: ContractStatus;
  terms?: string;
  created_at: string;
}

export interface CreateContractInput {
  supplier_id: string;
  title: string;
  start_date?: string;
  end_date?: string;
  value?: number;
  terms?: string;
}
export type UpdateContractInput = Partial<CreateContractInput>;

export interface ContractListParams {
  status?: ContractStatus;
  supplier_id?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedContracts {
  data: Contract[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

const base = (org: string) => `/api/v1/${org}/inventory/contracts`;

export const contractsApi = {
  list: (org: string, params?: ContractListParams): Promise<PaginatedContracts> => apiClient.get<PaginatedContracts>(base(org), params),
  get: (org: string, id: string) => apiClient.get<Contract>(`${base(org)}/${id}`),
  create: (org: string, data: CreateContractInput) => apiClient.post<Contract>(base(org), data),
  update: (org: string, id: string, data: UpdateContractInput) => apiClient.put<Contract>(`${base(org)}/${id}`, data),
  activate: (org: string, id: string) => apiClient.post<Contract>(`${base(org)}/${id}/activate`, {}),
  terminate: (org: string, id: string) => apiClient.post<Contract>(`${base(org)}/${id}/terminate`, {}),
};
