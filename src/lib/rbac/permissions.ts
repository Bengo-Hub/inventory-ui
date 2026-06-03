/**
 * Inventory permission constants.
 * Format: inventory.{module}.{action}
 * Every value here MUST exist in the `Permission` union in src/lib/auth/types.ts.
 * Mirrors pos-ui's lib/rbac/permissions.ts `P` idiom.
 */

import type { Permission } from '@/lib/auth/types';

export const P = {
  // Catalog
  CATALOG_ADD:        'inventory.catalog.add',
  CATALOG_READ:       'inventory.catalog.read',
  CATALOG_CHANGE:     'inventory.catalog.change',
  CATALOG_DELETE:     'inventory.catalog.delete',
  CATALOG_MANAGE:     'inventory.catalog.manage',

  // Warehouses
  WAREHOUSES_ADD:     'inventory.warehouses.add',
  WAREHOUSES_READ:    'inventory.warehouses.read',
  WAREHOUSES_CHANGE:  'inventory.warehouses.change',
  WAREHOUSES_DELETE:  'inventory.warehouses.delete',
  WAREHOUSES_MANAGE:  'inventory.warehouses.manage',

  // Adjustments
  ADJUSTMENTS_ADD:    'inventory.adjustments.add',
  ADJUSTMENTS_READ:   'inventory.adjustments.read',
  ADJUSTMENTS_CHANGE: 'inventory.adjustments.change',
  ADJUSTMENTS_DELETE: 'inventory.adjustments.delete',
  ADJUSTMENTS_MANAGE: 'inventory.adjustments.manage',

  // Stock
  STOCK_ADD:          'inventory.stock.add',
  STOCK_READ:         'inventory.stock.read',
  STOCK_CHANGE:       'inventory.stock.change',
  STOCK_DELETE:       'inventory.stock.delete',
  STOCK_MANAGE:       'inventory.stock.manage',

  // Transfers
  TRANSFERS_ADD:      'inventory.transfers.add',
  TRANSFERS_READ:     'inventory.transfers.read',
  TRANSFERS_CHANGE:   'inventory.transfers.change',
  TRANSFERS_DELETE:   'inventory.transfers.delete',
  TRANSFERS_MANAGE:   'inventory.transfers.manage',

  // Suppliers
  SUPPLIERS_ADD:      'inventory.suppliers.add',
  SUPPLIERS_READ:     'inventory.suppliers.read',
  SUPPLIERS_CHANGE:   'inventory.suppliers.change',
  SUPPLIERS_DELETE:   'inventory.suppliers.delete',
  SUPPLIERS_MANAGE:   'inventory.suppliers.manage',

  // Purchase orders
  PURCHASES_ADD:      'inventory.purchases.add',
  PURCHASES_READ:     'inventory.purchases.read',
  PURCHASES_CHANGE:   'inventory.purchases.change',
  PURCHASES_DELETE:   'inventory.purchases.delete',
  PURCHASES_MANAGE:   'inventory.purchases.manage',

  // Reports
  REPORTS_READ:       'inventory.reports.read',
  REPORTS_MANAGE:     'inventory.reports.manage',

  // Settings
  SETTINGS_ADD:       'inventory.settings.add',
  SETTINGS_READ:      'inventory.settings.read',
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
