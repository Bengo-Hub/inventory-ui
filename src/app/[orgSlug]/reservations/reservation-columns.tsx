'use client';

// DataTable column definitions for the Reservations list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Reservation } from '@/lib/api/reservations';

export const STATUS_VARIANT: Record<string, 'default' | 'success' | 'outline' | 'warning' | 'error'> = {
  pending: 'warning',
  confirmed: 'default',
  consumed: 'success',
  released: 'outline',
};

export const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  consumed: 'Consumed',
  released: 'Released',
};

// Items only carry a SKU (no item name — see stock.ReservationSummary), so the summary shown
// here is SKU-based: the first couple, then a "+N more" tail for anything longer.
function itemsSummary(r: Reservation): string {
  if (r.items.length === 0) return '—';
  const shown = r.items.slice(0, 2).map((i) => `${i.sku} ×${i.reserved_qty}`);
  const extra = r.items.length - shown.length;
  return extra > 0 ? `${shown.join(', ')} +${extra} more` : shown.join(', ');
}

export function buildReservationColumns(): DataTableColumn<Reservation>[] {
  return [
    {
      key: 'order',
      header: 'Order',
      primary: true,
      accessor: (r) => r.order_id,
      cellClassName: 'font-mono text-xs font-medium',
      render: (r) => r.order_id.slice(0, 8),
    },
    {
      key: 'items',
      header: 'Items',
      accessor: (r) => itemsSummary(r),
      render: (r) => (
        <div>
          <span>{itemsSummary(r)}</span>
          {r.item_count > 0 && (
            <span className="block text-xs text-muted-foreground">{r.item_count} item{r.item_count === 1 ? '' : 's'}</span>
          )}
        </div>
      ),
    },
    {
      key: 'totalQuantity',
      header: 'Total Qty',
      align: 'right',
      sortable: true,
      accessor: (r) => r.total_quantity,
      cellClassName: 'font-semibold tabular-nums',
      render: (r) => r.total_quantity.toLocaleString(),
    },
    {
      key: 'warehouseName',
      header: 'Warehouse',
      hideBelow: 'md',
      accessor: (r) => r.warehouse_name ?? '—',
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
      accessor: (r) => r.created_at,
      cellClassName: 'text-muted-foreground',
      render: (r) => new Date(r.created_at).toLocaleDateString(),
    },
  ];
}
