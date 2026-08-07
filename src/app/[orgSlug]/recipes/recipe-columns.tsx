'use client';

// DataTable column definitions for the Recipes / BOM list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { FlaskConical, Trash2 } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Recipe } from '@/lib/api/recipes';

function formatCurrency(value?: number | null): string {
  if (value == null || isNaN(value)) return '—';
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(value);
}

export interface RecipeColumnCallbacks {
  isMfg: boolean;
  onManageIngredients: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
}

export function buildRecipeColumns(cb: RecipeColumnCallbacks): DataTableColumn<Recipe>[] {
  return [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      sortable: true,
      accessor: (r) => r.name,
      cellClassName: 'font-medium',
    },
    {
      key: 'item_name',
      header: 'Produces',
      hideBelow: 'md',
      accessor: (r) => r.item_name || r.sku || '—',
      cellClassName: 'text-muted-foreground',
    },
    {
      key: 'ingredients',
      header: 'Ingredients',
      align: 'right',
      hideBelow: 'sm',
      accessor: (r) => r.ingredients?.length ?? 0,
      render: (r) => <Badge variant="outline">{r.ingredients?.length ?? 0}</Badge>,
    },
    {
      key: 'cost_per_portion',
      header: cb.isMfg ? 'Unit Cost' : 'Cost/Portion',
      align: 'right',
      hideBelow: 'lg',
      accessor: (r) => r.cost_per_portion ?? 0,
      cellClassName: 'tabular-nums',
      render: (r) => formatCurrency(r.cost_per_portion),
    },
    {
      key: 'suggested_price',
      header: cb.isMfg ? 'Material Cost' : 'Suggested Price',
      align: 'right',
      hideBelow: 'lg',
      accessor: (r) => (cb.isMfg ? r.total_cost : r.suggested_price) ?? 0,
      cellClassName: 'tabular-nums',
      render: (r) => formatCurrency(cb.isMfg ? r.total_cost : r.suggested_price),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (recipe) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            title="Manage ingredients"
            aria-label="Manage ingredients"
            onClick={() => cb.onManageIngredients(recipe)}
          >
            <FlaskConical className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => cb.onEdit(recipe)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" aria-label="Delete recipe" onClick={() => cb.onDelete(recipe)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ];
}
