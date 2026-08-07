'use client';

// DataTable column definitions for the Menu Engineering matrix — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { MenuCategory, MenuMatrixItem } from '@/lib/api/reports';

export type CategoryConfig = {
  label: string;
  description: string;
  variant: 'default' | 'success' | 'warning' | 'error' | 'outline';
  action: string;
};

export const CATEGORY: Record<MenuCategory, CategoryConfig> = {
  STAR: {
    label: 'Star',
    description: 'High popularity, high profit',
    variant: 'success',
    action: 'Promote and protect — keep quality consistent',
  },
  PLOWHORSE: {
    label: 'Plowhorse',
    description: 'High popularity, low profit',
    variant: 'warning',
    action: 'Reprice or reduce portion cost to improve margin',
  },
  PUZZLE: {
    label: 'Puzzle',
    description: 'Low popularity, high profit',
    variant: 'default',
    action: 'Reposition, rename, or feature in specials',
  },
  DOG: {
    label: 'Dog',
    description: 'Low popularity, low profit',
    variant: 'error',
    action: 'Consider removing from menu or reinventing',
  },
};

function formatCurrency(v?: number): string {
  if (v == null) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(v);
}

export function CategoryBadge({ category }: { category: MenuCategory }) {
  const cfg = CATEGORY[category];
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export function buildMenuEngineeringColumns(): DataTableColumn<MenuMatrixItem>[] {
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
      key: 'popularity',
      header: 'Units Sold',
      align: 'right',
      sortable: true,
      accessor: (r) => r.popularity,
      render: (r) => r.popularity.toFixed(0),
    },
    {
      key: 'contrib_margin',
      header: 'Contrib. Margin %',
      align: 'right',
      sortable: true,
      accessor: (r) => r.contrib_margin,
      cellClassName: 'font-medium',
      render: (r) => `${r.contrib_margin.toFixed(1)}%`,
    },
    {
      key: 'suggested_price',
      header: 'Suggested Price',
      align: 'right',
      sortable: true,
      accessor: (r) => r.suggested_price ?? 0,
      render: (r) => formatCurrency(r.suggested_price),
    },
    {
      key: 'category',
      header: 'Category',
      align: 'center',
      filterable: true,
      accessor: (r) => CATEGORY[r.category].label,
      render: (r) => <CategoryBadge category={r.category} />,
    },
  ];
}
