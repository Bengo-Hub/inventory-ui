'use client';

// DataTable column definitions for the Stock Reconciliation (ingredient utilization)
// report's recipe-breakdown table — split out of page.tsx to mirror the platform's
// <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { RecipeBreakdownRow } from '@/lib/api/reports';

function formatNumber(v: number, decimals = 2): string {
  return v.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

function formatCurrency(v: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(v);
}

export interface IngredientUtilizationColumnOptions {
  sourceCol: string;
  directLabel: string;
  unit?: string;
}

export function buildIngredientUtilizationColumns(opts: IngredientUtilizationColumnOptions): DataTableColumn<RecipeBreakdownRow>[] {
  return [
    {
      key: 'recipe_name',
      header: opts.sourceCol,
      primary: true,
      sortable: true,
      accessor: (r) => r.recipe_name || opts.directLabel,
      render: (r) => (
        <div>
          <div className="font-medium">{r.recipe_name || opts.directLabel}</div>
          {r.recipe_sku && <div className="text-xs text-muted-foreground">{r.recipe_sku}</div>}
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      sortable: true,
      accessor: (r) => r.quantity,
      cellClassName: 'tabular-nums',
      render: (r) => `${formatNumber(r.quantity)} ${opts.unit ?? ''}`,
    },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      sortable: true,
      accessor: (r) => r.cost,
      cellClassName: 'tabular-nums',
      render: (r) => formatCurrency(r.cost),
    },
    {
      key: 'pct_of_total',
      header: 'Share',
      align: 'right',
      sortable: true,
      accessor: (r) => r.pct_of_total,
      render: (r) => <Badge variant="outline">{formatNumber(r.pct_of_total, 1)}%</Badge>,
    },
  ];
}
