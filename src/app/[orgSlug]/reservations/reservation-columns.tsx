'use client';

// DataTable column definitions for the Reservations list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Reservation } from './page';

export const STATUS_VARIANT: Record<string, 'default' | 'success' | 'outline' | 'warning' | 'error'> = {
  confirmed: 'default',
  consumed: 'success',
  released: 'outline',
};

export const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Confirmed',
  consumed: 'Consumed',
  released: 'Released',
};

export function buildReservationColumns(): DataTableColumn<Reservation>[] {
  return [
    {
      key: 'order',
      header: 'Order',
      primary: true,
      accessor: (r) => r.orderRef ?? r.orderId,
      cellClassName: 'font-mono text-xs font-medium',
      render: (r) => r.orderRef ?? r.orderId.slice(0, 8),
    },
    {
      key: 'item',
      header: 'Item',
      sortable: true,
      accessor: (r) => r.itemName,
      render: (r) => (
        <div>
          <span className="font-medium">{r.itemName}</span>
          <span className="block text-xs text-muted-foreground font-mono">{r.itemSku}</span>
        </div>
      ),
    },
    {
      key: 'quantityReserved',
      header: 'Qty Reserved',
      align: 'right',
      sortable: true,
      accessor: (r) => r.quantityReserved,
      cellClassName: 'font-semibold tabular-nums',
      render: (r) => r.quantityReserved.toLocaleString(),
    },
    {
      key: 'warehouseName',
      header: 'Warehouse',
      hideBelow: 'md',
      accessor: (r) => r.warehouseName,
      cellClassName: 'text-muted-foreground',
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      accessor: (r) => STATUS_LABEL[r.status] ?? r.status,
      render: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>{STATUS_LABEL[r.status] ?? r.status}</Badge>,
    },
    {
      key: 'createdAt',
      header: 'Created',
      hideBelow: 'sm',
      sortable: true,
      accessor: (r) => r.createdAt,
      cellClassName: 'text-muted-foreground',
      render: (r) => new Date(r.createdAt).toLocaleDateString(),
    },
  ];
}
