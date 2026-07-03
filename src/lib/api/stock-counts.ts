import { apiClient } from './client';

export type StockCountStatus = 'draft' | 'counting' | 'review' | 'approved' | 'cancelled';

export interface StockCount {
  id: string;
  warehouse_id: string;
  reference?: string;
  status: StockCountStatus;
  counted_by?: string;
  approved_by?: string;
  approved_at?: string | null;
  created_at: string;
}

export interface StockCountLine {
  id: string;
  item_id: string;
  sku: string;
  system_qty: number;
  counted_qty: number | null;
  variance: number | null;
  posted: boolean;
}

export interface StockCountDetail extends StockCount {
  lines: StockCountLine[];
}

export interface CreateStockCountInput {
  warehouse_id: string;
  reference?: string;
  /** Pre-populate lines from the warehouse's current balances so the team counts against a snapshot. */
  snapshot?: boolean;
}

export interface UpsertLineInput {
  item_id: string;
  sku: string;
  system_qty?: number;
  counted_qty: number;
}

export interface ApproveResult {
  count?: StockCount;
  status?: string;         // "partial" when some variance lines failed to post
  posted_lines?: number;
  failed_skus?: string[];
  total_variance?: number;
  message?: string;
}

const base = (orgSlug: string) => `/api/v1/${orgSlug}/inventory/stock-counts`;

export const stockCountsApi = {
  list: async (orgSlug: string, status?: StockCountStatus): Promise<StockCount[]> => {
    const res = await apiClient.get<{ data: StockCount[] } | StockCount[]>(
      base(orgSlug),
      status ? { status } : undefined,
    );
    return Array.isArray(res) ? res : res.data ?? [];
  },

  get: (orgSlug: string, id: string) =>
    apiClient.get<StockCountDetail>(`${base(orgSlug)}/${id}`),

  create: (orgSlug: string, data: CreateStockCountInput) =>
    apiClient.post<StockCount>(base(orgSlug), data),

  upsertLine: (orgSlug: string, id: string, data: UpsertLineInput) =>
    apiClient.post<{ status: string; variance: number }>(`${base(orgSlug)}/${id}/lines`, data),

  submit: (orgSlug: string, id: string) =>
    apiClient.post<{ status: string }>(`${base(orgSlug)}/${id}/submit`, {}),

  approve: (orgSlug: string, id: string) =>
    apiClient.post<ApproveResult>(`${base(orgSlug)}/${id}/approve`, {}),

  cancel: (orgSlug: string, id: string) =>
    apiClient.post<{ status: string }>(`${base(orgSlug)}/${id}/cancel`, {}),
};
