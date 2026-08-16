'use client';

// DataTable column definitions for the Stock Adjustments history list — split out of
// page.tsx to mirror the platform's <page>-columns.tsx convention.

import type { MouseEvent } from 'react';
import { Button } from '@/components/ui/base';
import { Printer } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { StockAdjustment } from '@/lib/api/stock';

export interface AdjustmentColumnCallbacks {
  onPrint: (a: StockAdjustment) => void;
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
      cellClassName: 'text-muted-foreground capitalize',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (a) => a.reference
        ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Print / Export"
            title="Print the adjustment note for this reference"
            onClick={(e: MouseEvent) => { e.stopPropagation(); cb.onPrint(a); }}
          >
            <Printer className="h-4 w-4" />
          </Button>
        )
        : null,
    },
  ];
}
