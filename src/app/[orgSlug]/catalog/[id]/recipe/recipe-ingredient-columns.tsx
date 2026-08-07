'use client';

// DataTable column definitions for the Item Recipe/BOM page's Ingredients table — split
// out of page.tsx to mirror the platform's <page>-columns.tsx convention.

import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { RecipeIngredient } from '@/lib/api/recipes';

export function buildRecipeIngredientColumns(): DataTableColumn<RecipeIngredient>[] {
  return [
    {
      key: 'item_name',
      header: 'Name',
      primary: true,
      sortable: true,
      accessor: (ing) => ing.item_name,
      cellClassName: 'font-medium',
    },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      sortable: true,
      accessor: (ing) => ing.quantity,
      cellClassName: 'tabular-nums font-semibold',
    },
    {
      key: 'unit_of_measure',
      header: 'Unit',
      accessor: (ing) => ing.unit_of_measure ?? '',
      cellClassName: 'text-muted-foreground',
    },
    {
      key: 'waste_percent',
      header: 'Waste %',
      align: 'right',
      hideBelow: 'sm',
      sortable: true,
      accessor: (ing) => ing.waste_percent,
      cellClassName: 'tabular-nums text-muted-foreground',
      render: (ing) => `${ing.waste_percent}%`,
    },
    {
      key: 'item_cost_price',
      header: 'Cost',
      align: 'right',
      hideBelow: 'md',
      sortable: true,
      accessor: (ing) => ing.item_cost_price ?? 0,
      cellClassName: 'tabular-nums',
      render: (ing) => (ing.item_cost_price != null ? ing.item_cost_price.toLocaleString() : '—'),
    },
  ];
}
