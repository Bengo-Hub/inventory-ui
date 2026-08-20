'use client';

// DataTable column definitions for the Stock Adjustments history list — split out of
// page.tsx to mirror the platform's <page>-columns.tsx convention.

import { DocFormatMenu, type DocFormat } from '@/components/inventory/DocFormatMenu';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { StockAdjustment } from '@/lib/api/stock';

export interface AdjustmentColumnCallbacks {
  onPrint: (a: StockAdjustment, format: DocFormat) => void;
}

// Prettier labels for the reason enum instead of raw `capitalize` CSS on the wire value —
// location_hidden/location_unhidden are 0-quantity visibility toggles (SetItemOutletMembership's
// "hide" default), distinct from an actual location_move.
const REASON_LABELS: Record<string, string> = {
  location_move: 'Location move',
  location_hidden: 'Outlet hidden',
  location_unhidden: 'Outlet unhidden',
};

function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? reason;
}

export function buildAdjustmentColumns(cb: AdjustmentColumnCallbacks): DataTableColumn<StockAdjustment>[] {
  return [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      accessor: (a) => a.adjusted_at ?? a.created_at,
      cellClassName: 'text-muted-foreground whitespace-nowrap',
      render: (a) => new Date(a.adjusted_at ?? a.created_at).toLocaleDateString(),
    },
    {
      key: 'item_name',
      header: 'Item',
      primary: true,
      sortable: true,
      accessor: (a) => a.item_name || '—',
      render: (a) => <div className="font-medium">{a.item_name || '—'}</div>,
    },
    {
      key: 'warehouse_name',
      header: 'Warehouse',
      hideBelow: 'md',
      accessor: (a) => a.warehouse_name || '—',
      cellClassName: 'text-muted-foreground',
    },
    {
      key: 'quantity_change',
      header: 'Qty Change',
      align: 'right',
      sortable: true,
      accessor: (a) => a.quantity_change,
      cellClassName: 'tabular-nums font-semibold',
      render: (a) => (
        <span className={a.quantity_change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}>
          {a.quantity_change > 0 ? '+' : ''}
          {a.quantity_change}
        </span>
      ),
    },
    {
      key: 'reason',
      header: 'Reason',
      hideBelow: 'sm',
      filterable: true,
      accessor: (a) => a.reason,
      cellClassName: 'text-muted-foreground',
      render: (a) => reasonLabel(a.reason),
    },
    {
      key: 'notes',
      header: 'Details',
      hideBelow: 'lg',
      accessor: (a) => a.notes || '',
      cellClassName: 'text-muted-foreground text-xs max-w-[220px] truncate',
      render: (a) => a.notes || '—',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (a) => a.reference
        ? <DocFormatMenu label="Export" onSelect={(format) => cb.onPrint(a, format)} />
        : null,
    },
  ];
}
