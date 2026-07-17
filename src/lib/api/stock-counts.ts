import { apiClient } from './client';

export type StockCountStatus = 'draft' | 'counting' | 'review' | 'approved' | 'cancelled';

/** Variance classifications a reviewer can pick per line — posted as the stock
 *  adjustment reason on approval. Unclassified lines post as count_variance. */
export const VARIANCE_REASONS = [
  { value: 'count_variance', label: 'Count variance (unclassified)' },
  { value: 'shrinkage', label: 'Pilferage / shrinkage' },
  { value: 'damaged', label: 'Wastage / damaged' },
  { value: 'expired', label: 'Expired' },
  { value: 'found', label: 'Surplus found' },
  { value: 'correction', label: 'Record correction' },
  { value: 'other', label: 'Other' },
] as const;

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
  /** Item display name (enriched server-side). */
  item_name?: string;
  /** Item barcode — lets hardware/camera scans match a line locally. */
  barcode?: string;
  /** The item's stock unit abbreviation (kg, ml, pc…) quantities are counted in. */
  unit?: string;
  /** Item type (GOODS/INGREDIENT/RECIPE…) — lets teams filter to the section they count. */
  item_type?: string;
  /** Category name — kitchen counts Raw Ingredients, the bar counts Beers, etc. */
  category_name?: string;
  system_qty: number;
  counted_qty: number | null;
  variance: number | null;
  /** Variance classification (StockAdjustment reason); '' = count_variance. */
  reason?: string;
  posted: boolean;
}

export interface StockCountDetail extends StockCount {
  lines: StockCountLine[];
}

export interface CreateStockCountInput {
  warehouse_id?: string;
  reference?: string;
  /** Pre-populate lines from the warehouse's current balances so the team counts against a snapshot. */
  snapshot?: boolean;
  /** Start from a department count sheet (kitchen daily sheet, barista counter…). */
  template_id?: string;
}

export interface UpsertLineInput {
  item_id: string;
  sku: string;
  system_qty?: number;
  counted_qty: number;
  reason?: string;
}

export interface ApproveResult {
  count?: StockCount;
  status?: string;         // "partial" when some variance lines failed to post
  posted_lines?: number;
  failed_skus?: string[];
  total_variance?: number;
  message?: string;
}

/** Reusable department count sheet (kitchen daily stock sheet, barista counter…). */
export interface StockCountTemplate {
  id: string;
  name: string;
  description?: string;
  warehouse_id?: string | null;
  item_ids?: string[];
  category_ids?: string[];
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StockCountTemplatePayload {
  name: string;
  description?: string;
  warehouse_id?: string | null;
  item_ids?: string[];
  category_ids?: string[];
  is_active?: boolean;
}

const base = (orgSlug: string) => `/api/v1/${orgSlug}/inventory/stock-counts`;
const tplBase = (orgSlug: string) => `/api/v1/${orgSlug}/inventory/stock-count-templates`;

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

  listTemplates: async (orgSlug: string): Promise<StockCountTemplate[]> => {
    const res = await apiClient.get<{ data: StockCountTemplate[] } | StockCountTemplate[]>(tplBase(orgSlug));
    return Array.isArray(res) ? res : res.data ?? [];
  },

  createTemplate: (orgSlug: string, data: StockCountTemplatePayload) =>
    apiClient.post<StockCountTemplate>(tplBase(orgSlug), data),

  updateTemplate: (orgSlug: string, id: string, data: StockCountTemplatePayload) =>
    apiClient.put<StockCountTemplate>(`${tplBase(orgSlug)}/${id}`, data),

  deleteTemplate: (orgSlug: string, id: string) =>
    apiClient.delete<void>(`${tplBase(orgSlug)}/${id}`),
};
