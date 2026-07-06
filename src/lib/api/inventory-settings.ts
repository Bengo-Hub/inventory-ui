import { apiClient } from './client';

export interface InventorySettings {
  tenant_id: string;
  low_stock_threshold_pct: number;
  critical_stock_threshold_pct: number;
  default_reorder_level: number;
  unit_reorder_defaults: Record<string, number>;
  expiry_warning_days: number;
  enable_low_stock_notifications: boolean;
  enable_expiry_notifications: boolean;
  notification_email?: string | null;
  default_warehouse_id?: string | null;
  enable_lot_tracking: boolean;
  enable_expiry_tracking: boolean;
  purchase_order_approval_required: boolean;
  auto_adjust_on_transfer: boolean;
  // Non-depletion (manual stock counting) policy: when true, RECIPE items sell without
  // depleting ingredient stock unless individually set to "tracked"; goods keep depleting.
  recipe_items_non_depleting_default: boolean;
  // When non-depleting, still record theoretical usage rows for AvT/food-cost reports.
  record_theoretical_usage: boolean;
  lots_module_enabled: boolean;
  recipes_module_enabled: boolean;
  purchase_orders_enabled: boolean;
  supplier_management_enabled: boolean;
  // Hospitality modules
  enable_room_pricing: boolean;
  enable_facility_booking: boolean;
  enable_conference_packages: boolean;
  // Costing & tax / compliance
  costing_method: 'wavg' | 'fifo' | 'lifo' | 'fefo';
  default_target_margin_percent?: number | null;
  prices_inclusive_of_tax: boolean;
  default_tax_code: string;
  updated_at: string;
}

export interface UpdateInventorySettingsInput {
  low_stock_threshold_pct?: number;
  critical_stock_threshold_pct?: number;
  default_reorder_level?: number;
  unit_reorder_defaults?: Record<string, number>;
  expiry_warning_days?: number;
  enable_low_stock_notifications?: boolean;
  enable_expiry_notifications?: boolean;
  notification_email?: string | null;
  default_warehouse_id?: string | null;
  enable_lot_tracking?: boolean;
  enable_expiry_tracking?: boolean;
  purchase_order_approval_required?: boolean;
  auto_adjust_on_transfer?: boolean;
  recipe_items_non_depleting_default?: boolean;
  record_theoretical_usage?: boolean;
  default_target_margin_percent?: number;
  enable_room_pricing?: boolean;
  enable_facility_booking?: boolean;
  enable_conference_packages?: boolean;
  prices_inclusive_of_tax?: boolean;
  default_tax_code?: string;
}

export interface UpdateInventoryModulesInput {
  lots_module_enabled?: boolean;
  recipes_module_enabled?: boolean;
  purchase_orders_enabled?: boolean;
  supplier_management_enabled?: boolean;
}

function settingsBase(orgSlug: string) {
  return `/api/v1/${orgSlug}/inventory/settings`;
}

export const inventorySettingsApi = {
  get: (orgSlug: string) =>
    apiClient.get<InventorySettings>(settingsBase(orgSlug)),

  put: (orgSlug: string, body: UpdateInventorySettingsInput) =>
    apiClient.put<InventorySettings>(settingsBase(orgSlug), body),

  patchModules: (orgSlug: string, body: UpdateInventoryModulesInput) =>
    apiClient.patch<InventorySettings>(`${settingsBase(orgSlug)}/modules`, body),
};
