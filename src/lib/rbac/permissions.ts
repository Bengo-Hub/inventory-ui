/**
 * Inventory permission constants.
 *
 * Format: inventory.{module}.{action}
 *
 * IMPORTANT: these VALUES must exactly match the permission codes that inventory-api
 * seeds (cmd/seed/seed_permissions.go → inventory_permissions) and enforces via
 * middleware.RequirePermission. The backend is the single source of truth: a button is
 * shown iff the same code guards the endpoint it calls. The constant KEYS keep their
 * historical UI-friendly names (CATALOG_*, PURCHASES_*, …) so call-sites don't churn, but
 * the values map onto the real backend modules:
 *
 *   UI concept      →  backend module (permission code)
 *   ─────────────────────────────────────────────────
 *   catalog/items   →  items
 *   adjustments     →  stock          (stock adjustments)
 *   transfers       →  stock          (stock transfers — guarded by inventory.stock.change)
 *   suppliers       →  procurement    (supplier routes guard on inventory.procurement.*)
 *   purchases (PO)  →  procurement
 *   reports         →  audit / settings
 *   read            →  view           (backend action verb is `view`, never `read`)
 *
 * Mirrors pos-ui's hooks/rbac idiom.
 */

import type { Permission } from '@/lib/auth/types';

export const P = {
  // Catalog / items
  CATALOG_ADD:        'inventory.items.add',
  CATALOG_READ:       'inventory.items.view',
  CATALOG_CHANGE:     'inventory.items.change',
  CATALOG_DELETE:     'inventory.items.delete',
  CATALOG_MANAGE:     'inventory.items.manage',

  // Warehouses
  WAREHOUSES_ADD:     'inventory.warehouses.add',
  WAREHOUSES_READ:    'inventory.warehouses.view',
  WAREHOUSES_CHANGE:  'inventory.warehouses.change',
  WAREHOUSES_DELETE:  'inventory.warehouses.delete',
  WAREHOUSES_MANAGE:  'inventory.warehouses.manage',

  // Adjustments → stock module
  ADJUSTMENTS_ADD:    'inventory.stock.add',
  ADJUSTMENTS_READ:   'inventory.stock.view',
  ADJUSTMENTS_CHANGE: 'inventory.stock.change',
  ADJUSTMENTS_DELETE: 'inventory.stock.delete',
  ADJUSTMENTS_MANAGE: 'inventory.stock.manage',

  // Stock
  STOCK_ADD:          'inventory.stock.add',
  STOCK_READ:         'inventory.stock.view',
  STOCK_CHANGE:       'inventory.stock.change',
  STOCK_DELETE:       'inventory.stock.delete',
  STOCK_MANAGE:       'inventory.stock.manage',

  // Stock counts / takes (already matched backend)
  STOCK_COUNT_VIEW:    'inventory.stock_count.view',
  STOCK_COUNT_ADD:     'inventory.stock_count.add',
  STOCK_COUNT_CHANGE:  'inventory.stock_count.change',
  STOCK_COUNT_APPROVE: 'inventory.stock_count.approve',

  // Transfers → stock module
  TRANSFERS_ADD:      'inventory.stock.add',
  TRANSFERS_READ:     'inventory.stock.view',
  TRANSFERS_CHANGE:   'inventory.stock.change',
  TRANSFERS_DELETE:   'inventory.stock.delete',
  TRANSFERS_MANAGE:   'inventory.stock.manage',

  // Suppliers → procurement module
  SUPPLIERS_ADD:      'inventory.procurement.add',
  SUPPLIERS_READ:     'inventory.procurement.view',
  SUPPLIERS_CHANGE:   'inventory.procurement.change',
  SUPPLIERS_DELETE:   'inventory.procurement.delete',
  SUPPLIERS_MANAGE:   'inventory.procurement.manage',

  // Purchase orders → procurement module
  PURCHASES_ADD:      'inventory.procurement.add',
  PURCHASES_READ:     'inventory.procurement.view',
  PURCHASES_CHANGE:   'inventory.procurement.change',
  PURCHASES_DELETE:   'inventory.procurement.delete',
  PURCHASES_MANAGE:   'inventory.procurement.manage',

  // Approvals (approval matrix) — match inventory-api codes exactly
  APPROVALS_VIEW:     'inventory.approvals.view',
  APPROVALS_ADD:      'inventory.approvals.add',
  APPROVALS_CHANGE:   'inventory.approvals.change',
  APPROVALS_DELETE:   'inventory.approvals.delete',
  APPROVALS_MANAGE:   'inventory.approvals.manage',

  // Reports → audit (read) / settings (manage)
  REPORTS_READ:       'inventory.audit.view',
  REPORTS_MANAGE:     'inventory.settings.manage',

  // Settings
  SETTINGS_ADD:       'inventory.settings.add',
  SETTINGS_READ:      'inventory.settings.view',
  SETTINGS_CHANGE:    'inventory.settings.change',
  SETTINGS_DELETE:    'inventory.settings.delete',
  SETTINGS_MANAGE:    'inventory.settings.manage',

  // Config
  CONFIG_VIEW:        'inventory.config.view',
  CONFIG_MANAGE:      'inventory.config.manage',

  // Users
  USERS_MANAGE:       'inventory.users.manage',
} as const satisfies Record<string, Permission>;

export type { Permission };
