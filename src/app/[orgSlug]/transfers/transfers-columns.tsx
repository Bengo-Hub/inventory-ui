'use client';

// DataTable column definitions for the Stock Transfers list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import { RowActions } from '@/components/inventory/RowActions';
import { Package } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { TransferSummary } from '@/lib/api/transfers';

export const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  draft: 'outline',
  pending: 'outline',
  in_transit: 'warning',
  received: 'success',
  cancelled: 'error',
};

// UI vocabulary mirrors the standard stock-transfer lifecycle (Pending → In Transit → Completed).
// The API enum (draft/in_transit/received/cancelled) is unchanged — only the display labels map.
export const STATUS_LABEL: Record<string, string> = {
  draft: 'Pending',
  pending: 'Pending',
  in_transit: 'In Transit',
  received: 'Completed',
  cancelled: 'Cancelled',
};

export interface TransferColumnCallbacks {
  onView: (t: TransferSummary) => void;
}

export function buildTransferColumns(cb: TransferColumnCallbacks): DataTableColumn<TransferSummary>[] {
  return [
    {
      key: 'transfer_number',
      header: 'Reference',
      primary: true,
      sortable: true,
      accessor: (t) => t.transfer_number,
      cellClassName: 'font-mono text-xs',
      render: (t) => t.transfer_number,
    },
    {
      key: 'source_warehouse_name',
      header: 'From',
      sortable: true,
      accessor: (t) => t.source_warehouse_name || '—',
    },
    {
      key: 'destination_warehouse_name',
      header: 'To',
      sortable: true,
      accessor: (t) => t.destination_warehouse_name || '—',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      filterable: true,
      accessor: (t) => STATUS_LABEL[t.status] ?? t.status,
      render: (t) => (
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[t.status] ?? 'default'}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Package className="h-3 w-3" />
            {t.line_count}
          </div>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      hideBelow: 'md',
      accessor: (t) => t.created_at,
      cellClassName: 'text-muted-foreground',
      render: (t) => new Date(t.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (t) => <RowActions onView={() => cb.onView(t)} />,
    },
  ];
}
