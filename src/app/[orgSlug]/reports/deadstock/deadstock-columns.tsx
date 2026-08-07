'use client';

// DataTable column definitions for the Deadstock report — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { DeadstockItem } from '@/lib/api/reports';

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}
function fmtDate(s: string) {
  try {
    return new Date(s).toLocaleDateString();
  } catch {
    return '—';
  }
}

export function buildDeadstockColumns(currency: string): DataTableColumn<DeadstockItem>[] {
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
      cellClassName: 'tabular-nums',
      render: (it) => fmt(it.on_hand),
    },
    {
      key: 'unit_cost',
      header: 'Unit cost',
      align: 'right',
      hideBelow: 'sm',
      sortable: true,
      accessor: (it) => it.unit_cost,
      cellClassName: 'tabular-nums',
      render: (it) => it.unit_cost.toLocaleString(),
    },
    {
      key: 'last_activity',
      header: 'Last activity',
      hideBelow: 'lg',
      sortable: true,
      accessor: (it) => it.last_activity,
      cellClassName: 'text-muted-foreground',
      render: (it) => fmtDate(it.last_activity),
    },
    {
      key: 'value',
      header: `Value (${currency})`,
      align: 'right',
      sortable: true,
      accessor: (it) => it.value,
      cellClassName: 'tabular-nums font-semibold',
      render: (it) => fmt(it.value),
    },
  ];
}
