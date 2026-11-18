'use client';

// DataTable column definitions for the Stock Levels list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { History, PackageX, SlidersHorizontal, Split } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { StockLevel } from '@/lib/api/stock';

// An item that holds no stock of its own never reads "Out of Stock" (KRA review 2026-11-11: menu
// recipes showed out of stock). A service or voucher is never stocked; a recipe with nothing on
// hand is made to order from its ingredients. A production recipe that holds stock still shows
// its real balance once it has some.
function noOwnStockLabel(available: number, itemType?: string): string | null {
  const t = (itemType ?? '').toUpperCase();
  if (t === 'SERVICE' || t === 'VOUCHER') return 'Not stocked';
  if (t === 'RECIPE' && available <= 0) return 'Made to order';
  return null;
}

export function stockStatus(available: number, reorderPoint?: number, itemType?: string): 'success' | 'warning' | 'error' | 'outline' {
  if (noOwnStockLabel(available, itemType)) return 'outline';
  if (available <= 0) return 'error';
  if (reorderPoint != null && available <= reorderPoint) return 'warning';
  return 'success';
}

export function stockLabel(available: number, reorderPoint?: number, itemType?: string): string {
  const own = noOwnStockLabel(available, itemType);
  if (own) return own;
  if (available <= 0) return 'Out of Stock';
  if (reorderPoint != null && available <= reorderPoint) return 'Low Stock';
  return 'In Stock';
}

export interface StockColumnCallbacks {
  canAdjust: boolean;
  canManageEOL: boolean;
  onHistory: (item: StockLevel) => void;
  onAdjust: (item: StockLevel) => void;
  onBreakdown: (item: StockLevel) => void;
  onMarkEOL: (item: StockLevel) => void;
}

export function buildStockColumns(cb: StockColumnCallbacks): DataTableColumn<StockLevel>[] {
  return [
    {
      key: 'item_name',
      header: 'Item',
      primary: true,
      sortable: true,
      accessor: (item) => item.item_name,
      cellClassName: 'font-medium',
    },
    {
      key: 'sku',
      header: 'SKU',
      hideBelow: 'md',
      accessor: (item) => item.sku,
      cellClassName: 'font-mono text-xs text-muted-foreground',
    },
    {
      key: 'warehouse_name',
      header: 'Warehouse',
      hideBelow: 'lg',
      filterable: true,
      accessor: (item) => item.warehouse_name,
      cellClassName: 'text-muted-foreground',
    },
    {
      key: 'available',
      header: 'Available',
      align: 'right',
      sortable: true,
      accessor: (item) => item.available,
      cellClassName: 'font-semibold tabular-nums',
      render: (item) => item.available.toLocaleString(),
    },
    {
      key: 'reserved',
      header: 'Reserved',
      align: 'right',
      hideBelow: 'sm',
      sortable: true,
      accessor: (item) => item.reserved,
      cellClassName: 'tabular-nums text-muted-foreground',
      render: (item) => item.reserved.toLocaleString(),
    },
    {
      key: 'reorder_point',
      header: 'Reorder At',
      align: 'right',
      hideBelow: 'md',
      sortable: true,
      accessor: (item) => item.reorder_point ?? 0,
      cellClassName: 'tabular-nums text-muted-foreground',
      render: (item) => (item.reorder_point != null ? item.reorder_point.toLocaleString() : <span className="text-muted-foreground/40">—</span>),
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      accessor: (item) => stockLabel(item.available, item.reorder_point, item.type),
      render: (item) => <Badge variant={stockStatus(item.available, item.reorder_point, item.type)}>{stockLabel(item.available, item.reorder_point, item.type)}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (item) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" title="Product stock history" aria-label="Product stock history" onClick={() => cb.onHistory(item)}>
            <History className="h-4 w-4" />
          </Button>
          {cb.canAdjust && (
            <>
              <Button variant="ghost" size="sm" title="Record Adjustment" aria-label="Record adjustment" onClick={() => cb.onAdjust(item)}>
                <SlidersHorizontal className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" title="Break Down Stock" aria-label="Break down stock" onClick={() => cb.onBreakdown(item)}>
                <Split className="h-4 w-4" />
              </Button>
            </>
          )}
          {cb.canManageEOL && (
            <Button
              variant="ghost"
              size="sm"
              title="Mark End-of-Life"
              aria-label="Mark End-of-Life"
              className="text-destructive hover:text-destructive"
              onClick={() => cb.onMarkEOL(item)}
            >
              <PackageX className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];
}
