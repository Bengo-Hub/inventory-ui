'use client';

// DataTable column definitions for the Stock Valuation report — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { StockValuationCategory, StockValuationItem } from '@/lib/api/reports';

function fmt(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function buildStockValuationCategoryColumns(currency: string): DataTableColumn<StockValuationCategory>[] {
  return [
    {
      key: 'category_name',
      header: 'Category',
      primary: true,
      sortable: true,
      accessor: (c) => c.category_name,
      cellClassName: 'font-medium',
    },
    {
      key: 'item_count',
      header: 'Items',
      align: 'right',
      sortable: true,
      accessor: (c) => c.item_count,
      cellClassName: 'tabular-nums',
    },
    {
      key: 'total_units',
      header: 'Units',
      align: 'right',
      hideBelow: 'sm',
      sortable: true,
      accessor: (c) => c.total_units,
      cellClassName: 'tabular-nums',
      render: (c) => fmt(c.total_units),
    },
    {
      key: 'total_value',
      header: `Value (${currency})`,
      align: 'right',
      sortable: true,
      accessor: (c) => c.total_value,
      cellClassName: 'tabular-nums font-semibold',
      render: (c) => fmt(c.total_value),
    },
  ];
}

export function buildStockValuationTopItemColumns(currency: string): DataTableColumn<StockValuationItem>[] {
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
