import { apiClient } from './client';

export type BatchStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'failed';

export interface ProductionBatch {
  id: string;
  batch_number: string;
  recipe_id: string;
  status: BatchStatus;
  planned_quantity: number;
  actual_quantity?: number | null;
  labor_cost: number;
  overhead_cost: number;
  outlet_id?: string | null;
  scheduled_date: string;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string;
  created_at: string;
}

export interface CreateBatchInput {
  recipe_id: string;
  planned_quantity: number;
  scheduled_date?: string | null;
  labor_cost?: number;
  overhead_cost?: number;
  notes?: string;
}

export interface BatchListParams { status?: BatchStatus; recipe_id?: string; page?: number; limit?: number; }
export interface PaginatedBatches { data: ProductionBatch[]; total: number; page: number; limit: number; hasMore: boolean; }

const base = (org: string) => `/api/v1/${org}/inventory/production-batches`;

export const productionBatchesApi = {
  list: (org: string, params?: BatchListParams): Promise<PaginatedBatches> => apiClient.get<PaginatedBatches>(base(org), params),
  get: (org: string, id: string) => apiClient.get<ProductionBatch>(`${base(org)}/${id}`),
  create: (org: string, data: CreateBatchInput) => apiClient.post<ProductionBatch>(base(org), data),
  start: (org: string, id: string) => apiClient.post<ProductionBatch>(`${base(org)}/${id}/start`, {}),
  complete: (org: string, id: string, actual_quantity: number) =>
    apiClient.post<ProductionBatch>(`${base(org)}/${id}/complete`, { actual_quantity }),
  cancel: (org: string, id: string, reason: string) => apiClient.post<ProductionBatch>(`${base(org)}/${id}/cancel`, { reason }),
  addQC: (org: string, id: string, result: string, notes?: string) =>
    apiClient.post(`${base(org)}/${id}/quality-checks`, { result, notes }),
};
