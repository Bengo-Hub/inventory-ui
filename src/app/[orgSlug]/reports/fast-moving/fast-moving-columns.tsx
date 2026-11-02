'use client';

// DataTable column definitions for the Fast Moving report, split out of page.tsx to mirror the
// platform's <page>-columns.tsx convention.

import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { FastMovingItem } from '@/lib/api/reports';

function fmtQty(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}
function fmtDate(s: string) {
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
}

export function buildFastMovingColumns(days: number): DataTableColumn<FastMovingItem>[] {
  return [
    {
      key: 'name',
      header: 'Item',
      primary: true,
      sortable: true,
      accessor: (it) => it.name,
      render: (it) => (
        <span className="font-medium">
          {it.name}
          <span className="block text-xs text-muted-foreground font-mono">{it.sku}</span>
        </span>
      ),
    },
    {
      key: 'category_name',
      header: 'Category',
      hideBelow: 'md',
      filterable: true,
      accessor: (it) => it.category_name || '',
      cellClassName: 'text-muted-foreground',
      render: (it) => it.category_name || '—',
    },
    {
      key: 'on_hand',
      header: 'On hand',
      align: 'right',
      hideBelow: 'sm',
      sortable: true,
      accessor: (it) => it.on_hand,
      // Negative on hand means the location is backordered on a busy item.
      cellClassName: 'tabular-nums',
      render: (it) => <span className={it.on_hand <= 0 ? 'text-destructive' : undefined}>{fmtQty(it.on_hand)}</span>,
    },
    {
      key: 'per_day',
      header: 'Per day',
      align: 'right',
      hideBelow: 'md',
      sortable: true,
      accessor: (it) => it.quantity_moved / days,
      cellClassName: 'tabular-nums text-muted-foreground',
      render: (it) => fmtQty(it.quantity_moved / days),
    },
    {
      key: 'last_activity',
      header: 'Last movement',
      hideBelow: 'lg',
      sortable: true,
      accessor: (it) => it.last_activity,
      cellClassName: 'text-muted-foreground',
      render: (it) => fmtDate(it.last_activity),
    },
    {
      key: 'quantity_moved',
      header: `Moved (${days}d)`,
      align: 'right',
      sortable: true,
      accessor: (it) => it.quantity_moved,
      cellClassName: 'tabular-nums font-semibold',
      render: (it) => fmtQty(it.quantity_moved),
    },
  ];
}
