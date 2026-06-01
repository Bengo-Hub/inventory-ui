import { apiClient } from './client';

export interface RecurrenceConfig {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly';
  time?: string;        // "HH:MM" (24h)
  days?: number[];      // weekly: 0=Sun..6=Sat
  monthDay?: number;    // monthly by date: 1-31
  weekNum?: number;     // monthly by weekday: 1-4 or -1 (last)
  weekDay?: number;     // monthly by weekday: 0-6
  yearMonth?: number;   // yearly: 1-12
  yearDay?: number;     // yearly: 1-31
}

export interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string;
  type: 'GOODS' | 'SERVICE' | 'RECIPE' | 'INGREDIENT' | 'VOUCHER' | 'EQUIPMENT';
  category_id?: string;
  category_name?: string;
  unit_id?: string;
  is_active: boolean;
  image_url?: string;
  barcode?: string;
  barcode_type?: string;
  requires_age_verification: boolean;
  is_perishable: boolean;
  track_lots: boolean;
  track_serial_numbers: boolean;
  weight_kg?: number;
  reorder_level?: number;
  reorder_quantity?: number;
  cost_price?: number | null;
  suggested_price?: number | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  // Current stock levels (sum across all warehouses, from ListItems).
  available?: number | null;
  on_hand?: number | null;
  // Event capacity fields — SERVICE type only
  total_capacity?: number | null;
  booked_capacity?: number | null;
  event_start_at?: string | null;
  event_end_at?: string | null;
  event_venue?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateItemInput {
  sku?: string;
  name: string;
  description?: string;
  type: string;
  category_id?: string;
  unit_id?: string;
  barcode?: string;
  reorder_level?: number;
  reorder_quantity?: number;
  cost_price?: number;
  is_active?: boolean;
  requires_age_verification?: boolean;
  is_perishable?: boolean;
  track_lots?: boolean;
  track_serial_numbers?: boolean;
  initial_quantity?: number;
  tags?: string[];
  image_url?: string;
  metadata?: Record<string, unknown>;
  // Event fields — SERVICE type only
  total_capacity?: number;
  event_start_at?: string;
  event_end_at?: string;
  event_venue?: string;
}

export type UpdateItemInput = Partial<CreateItemInput>;

function itemsBase(orgSlug: string) {
  return `/api/v1/${orgSlug}/inventory/items`;
}

export interface PaginatedItems {
  data: Item[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export const itemsApi = {
  list: async (orgSlug: string, params?: { type?: string; status?: string; search?: string; page?: number; limit?: number; unit_id?: string; category_id?: string }): Promise<PaginatedItems> => {
    const res = await apiClient.get<PaginatedItems | Item[]>(itemsBase(orgSlug), params as Record<string, string | number | undefined>);
    if (Array.isArray(res)) {
      return { data: res, total: res.length, page: 1, limit: res.length, hasMore: false };
    }
    return res as PaginatedItems;
  },

  get: (orgSlug: string, sku: string) =>
    apiClient.get<Item>(`${itemsBase(orgSlug)}/${sku}`),

  create: (orgSlug: string, data: CreateItemInput) =>
    apiClient.post<Item>(itemsBase(orgSlug), data),

  update: (orgSlug: string, sku: string, data: UpdateItemInput) =>
    apiClient.put<Item>(`${itemsBase(orgSlug)}/${sku}`, data),

  delete: (orgSlug: string, sku: string) =>
    apiClient.delete<void>(`${itemsBase(orgSlug)}/${sku}`),

  listEvents: (orgSlug: string, params?: { page?: number; limit?: number }): Promise<PaginatedItems> =>
    apiClient.get<PaginatedItems>(`/api/v1/${orgSlug}/inventory/events`, params as Record<string, string | number | undefined>),

  import: (orgSlug: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiClient.post<{ created: number; updated: number; failed: number; errors?: string[] }>(
      `${itemsBase(orgSlug)}/import`,
      form,
    );
  },

  bulkImport: (orgSlug: string, file: File, warehouseName?: string) => {
    const form = new FormData();
    form.append('file', file);
    if (warehouseName) form.append('warehouse_name', warehouseName);
    return apiClient.post<BulkImportResult>(
      `/api/v1/${orgSlug}/inventory/bulk-import`,
      form,
    );
  },

  downloadTemplateUrl: (orgSlug: string) =>
    `/api/v1/${orgSlug}/inventory/import-template`,

  createMenuItemComposite: (orgSlug: string, payload: MenuItemCompositeRequest) =>
    apiClient.post<MenuItemCompositeResult>(`/api/v1/${orgSlug}/inventory/items/menu-item`, payload),
};

// ── Composite menu item types ─────────────────────────────────────────────────

export interface MenuItemIngredientInput {
  ingredient_name?: string;
  ingredient_sku?:  string;
  qty:    number;
  unit:   string;
  waste_percent?: number;
  notes?: string;
  purchase_price?:     number;
  purchase_unit?:      string;
  purchase_pack_size?: number;
  yield_pct?:          number;
  cost_price?:         number;
}

export interface MenuItemModifierOptionInput {
  name:             string;
  price_adjustment?: number;
  stock_sku?:        string;
  is_default?:       boolean;
}

export interface MenuItemModifierInput {
  group_name:     string;
  is_required?:   boolean;
  min_selections?: number;
  max_selections?: number;
  options: MenuItemModifierOptionInput[];
}

export interface MenuItemCompositeRequest {
  sku?:          string;
  name:          string;
  category_name?: string;
  description?:  string;
  selling_price: number;
  tags?:         string[];
  is_perishable?: boolean;
  image_url?:    string;
  servings?:     number;
  target_margin_percent?: number;
  prep_time_minutes?:     number;
  ingredients:   MenuItemIngredientInput[];
  modifiers?:    MenuItemModifierInput[];
}

export interface ReorderSeed {
  sku:           string;
  reorder_level: number;
  reorder_qty:   number;
  source:        string;
}

export interface MenuItemCompositeResult {
  item:           Item;
  recipe:         import('./recipes').Recipe;
  reorder_seeds?: ReorderSeed[];
  warnings?:      string[];
}

export interface ImportSheetResult {
  created: number;
  updated: number;
  failed:  number;
  errors?: string[];
}

export interface BulkImportResult {
  items:     ImportSheetResult;
  recipes:   ImportSheetResult;
  modifiers: ImportSheetResult;
  stock:     ImportSheetResult;
}
