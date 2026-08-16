'use client';

// DataTable column definitions for the Stock Take list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import type { MouseEvent } from 'react';
import { Badge, Button } from '@/components/ui/base';
import { Printer } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { StockCount, StockCountStatus } from '@/lib/api/stock-counts';

export const STATUS_VARIANT: Record<StockCountStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  draft: 'outline',
  counting: 'warning',
  review: 'default',
  approved: 'success',
  cancelled: 'error',
};

export const STATUS_LABEL: Record<StockCountStatus, string> = {
  draft: 'Draft',
  counting: 'Counting',
  review: 'In Review',
  approved: 'Approved',
  cancelled: 'Cancelled',
};

export interface StockTakeColumnCallbacks {
  whName: (id?: string | null) => string;
  onPrint: (c: StockCount) => void;
}

export function buildStockTakeColumns(cb: StockTakeColumnCallbacks): DataTableColumn<StockCount>[] {
  return [
    {
      key: 'reference',
      header: 'Reference',
      primary: true,
      sortable: true,
      accessor: (c) => c.reference || 'Untitled count',
      render: (c) => (c.reference ? <span className="font-medium">{c.reference}</span> : <span className="text-muted-foreground">Untitled count</span>),
    },
    {
      key: 'warehouse',
      header: 'Location',
      accessor: (c) => cb.whName(c.warehouse_id),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      filterable: true,
      accessor: (c) => STATUS_LABEL[c.status],
      render: (c) => <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>,
    },
    {
      key: 'created_at',
      header: 'Started',
      sortable: true,
      hideBelow: 'sm',
      accessor: (c) => c.created_at,
      cellClassName: 'text-muted-foreground',
      render: (c) => new Date(c.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Print / Export"
            title="Print / Export PDF"
            onClick={(e: MouseEvent) => { e.stopPropagation(); cb.onPrint(c); }}
          >
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm">Open</Button>
        </div>
      ),
    },
  ];
}
