import { apiClient } from './client';

export type BatchStatus = 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'failed';

export interface BatchMaterial { id: string; item_id: string; unit_id?: string | null; quantity: number; cost: number; }
export interface QualityCheckRec { id: string; inspector_id?: string | null; result: string; notes?: string; check_date: string; }
export interface MaterialShortage { item_id: string; item_sku: string; required: number; available: number; }
export interface MaterialCheckResult { ok: boolean; shortages: MaterialShortage[]; }

export interface ProductionBatch {
  id: string;
  batch_number: string;
  recipe_id: string;
  status: BatchStatus;
  planned_quantity: number;
  actual_quantity?: number | null;
  labor_cost: number;
  overhead_cost: number;
  scrap_quantity?: number;
  unit_cost?: number | null;
  outlet_id?: string | null;
  scheduled_date: string;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string;
  raw_materials?: BatchMaterial[];
  quality_checks?: QualityCheckRec[];
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

export interface ManufacturingDashboard {
  total_batches: number;
  total_produced_quantity: number;
  completion_rate: number;
  scrap_total: number;
  recent_batches: { id: string; batch_number: string; status: BatchStatus; planned_quantity: number; actual_quantity?: number | null }[];
  batches_by_status: Record<string, number>;
}

const base = (org: string) => `/api/v1/${org}/inventory/production-batches`;
const mfgBase = (org: string) => `/api/v1/${org}/inventory/manufacturing`;

export const productionBatchesApi = {
  list: (org: string, params?: BatchListParams): Promise<PaginatedBatches> => apiClient.get<PaginatedBatches>(base(org), params),
  get: (org: string, id: string) => apiClient.get<ProductionBatch>(`${base(org)}/${id}`),
  create: (org: string, data: CreateBatchInput) => apiClient.post<ProductionBatch>(base(org), data),
  start: (org: string, id: string, force?: boolean) =>
    apiClient.post<ProductionBatch>(`${base(org)}/${id}/start${force ? '?force=true' : ''}`, {}),
  complete: (org: string, id: string, actual_quantity: number, scrap_quantity?: number) =>
    apiClient.post<ProductionBatch>(`${base(org)}/${id}/complete`, { actual_quantity, scrap_quantity }),
  cancel: (org: string, id: string, reason: string) => apiClient.post<ProductionBatch>(`${base(org)}/${id}/cancel`, { reason }),
  addQC: (org: string, id: string, result: string, notes?: string) =>
    apiClient.post(`${base(org)}/${id}/quality-checks`, { result, notes }),
  listMaterials: (org: string, id: string) => apiClient.get<BatchMaterial[]>(`${base(org)}/${id}/materials`),
  listQC: (org: string, id: string) => apiClient.get<QualityCheckRec[]>(`${base(org)}/${id}/quality-checks`),
  materialCheck: (org: string, recipeId: string, quantity: number): Promise<MaterialCheckResult> =>
    apiClient.get<MaterialCheckResult>(`${mfgBase(org)}/material-check`, { recipe_id: recipeId, quantity }),
  dashboard: (org: string): Promise<ManufacturingDashboard> => apiClient.get<ManufacturingDashboard>(`${mfgBase(org)}/dashboard`),
};
