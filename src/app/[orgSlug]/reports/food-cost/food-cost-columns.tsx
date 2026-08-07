'use client';

// DataTable column definitions for the Food Cost Variance report — split out of page.tsx
// to mirror the platform's <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { VarianceReportItem } from '@/lib/api/reports';

function formatCurrency(v: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(v);
}

function varianceBadge(pct: number): { label: string; variant: 'success' | 'warning' | 'error' } {
  const abs = Math.abs(pct);
  if (abs < 3) return { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, variant: 'success' };
  if (abs < 8) return { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, variant: 'warning' };
  return { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, variant: 'error' };
}

export function buildFoodCostColumns(): DataTableColumn<VarianceReportItem>[] {
  return [
    {
      key: 'recipe_name',
      header: 'Recipe',
      primary: true,
      sortable: true,
      accessor: (r) => r.recipe_name,
      render: (r) => (
        <div>
          <div className="font-medium">{r.recipe_name}</div>
          <div className="text-xs text-muted-foreground">{r.recipe_sku}</div>
        </div>
      ),
    },
    {
      key: 'theoretical_cost',
      header: 'Theoretical',
      align: 'right',
      sortable: true,
      accessor: (r) => r.theoretical_cost,
      render: (r) => formatCurrency(r.theoretical_cost),
    },
    {
      key: 'actual_cost',
      header: 'Actual',
      align: 'right',
      sortable: true,
      accessor: (r) => r.actual_cost,
      render: (r) => formatCurrency(r.actual_cost),
    },
    {
      key: 'variance_amount',
      header: 'Variance',
      align: 'right',
      sortable: true,
      accessor: (r) => r.actual_cost - r.theoretical_cost,
      cellClassName: 'font-medium',
      render: (r) => formatCurrency(r.actual_cost - r.theoretical_cost),
    },
    {
      key: 'variance_pct',
      header: 'Status',
      align: 'center',
      sortable: true,
      filterable: true,
      accessor: (r) => varianceBadge(r.variance_pct).label,
      render: (r) => {
        const { label, variant } = varianceBadge(r.variance_pct);
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
  ];
}
