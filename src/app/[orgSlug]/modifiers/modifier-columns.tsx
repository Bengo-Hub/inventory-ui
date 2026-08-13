'use client';

// DataTable column definitions for the Modifier Groups list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { Trash2 } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { ModifierGroup } from '@/lib/api/modifiers';

export interface ModifierColumnCallbacks {
  onEdit: (group: ModifierGroup) => void;
  onDelete: (group: ModifierGroup) => void;
}

export function buildModifierColumns(cb: ModifierColumnCallbacks): DataTableColumn<ModifierGroup>[] {
  return [
    {
      key: 'name',
      header: 'Group Name',
      primary: true,
      sortable: true,
      accessor: (g) => g.name,
      render: (g) => <span className="font-medium">{g.name}</span>,
    },
    {
      key: 'item_name',
      header: 'Linked Item',
      hideBelow: 'md',
      accessor: (g) => g.item_name ?? g.item_id ?? '',
      render: (g) =>
        g.item_name ? (
          <span className="text-sm">
            {g.item_name}
            {g.item_sku && <span className="ml-1.5 text-xs text-muted-foreground font-mono">({g.item_sku})</span>}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground font-mono">{g.item_id?.slice(0, 8)}…</span>
        ),
    },
    {
      key: 'min_selections',
      header: 'Min',
      align: 'right',
      hideBelow: 'sm',
      accessor: (g) => g.min_selections,
      cellClassName: 'tabular-nums',
    },
    {
      key: 'max_selections',
      header: 'Max',
      align: 'right',
      hideBelow: 'sm',
      accessor: (g) => g.max_selections,
      cellClassName: 'tabular-nums',
    },
    {
      key: 'is_required',
      header: 'Required',
      hideBelow: 'md',
      filterable: true,
      accessor: (g) => (g.is_required ? 'Yes' : 'No'),
      render: (g) => <Badge variant={g.is_required ? 'warning' : 'outline'}>{g.is_required ? 'Yes' : 'No'}</Badge>,
    },
    {
      key: 'options',
      header: 'Options',
      align: 'right',
      hideBelow: 'sm',
      accessor: (g) => g.options?.length ?? 0,
      render: (g) => <Badge variant="outline">{g.options?.length ?? 0}</Badge>,
    },
    {
      key: 'created_at',
      header: 'Added',
      hideBelow: 'lg',
      accessor: (g) => g.created_at ?? '',
      cellClassName: 'text-muted-foreground',
      render: (g) => (g.created_at ? new Date(g.created_at).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (group) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => cb.onEdit(group)}>
            Edit
          </Button>
          <button
            onClick={() => cb.onDelete(group)}
            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 transition-colors"
            title="Delete modifier group"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(value);
}

/** Nested read-only options table shown in the expanded row for a modifier group. */
export function ModifierOptionsPanel({ group }: { group: ModifierGroup }) {
  if (!group.options || group.options.length === 0) {
    return <p className="text-xs text-muted-foreground">No options yet</p>;
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-muted-foreground">
          <th className="text-left pb-2 font-medium">Option</th>
          <th className="text-left pb-2 font-medium">Deducts (SKU)</th>
          <th className="text-right pb-2 font-medium">Price Adj.</th>
          <th className="text-center pb-2 font-medium">Default</th>
          <th className="text-center pb-2 font-medium">Active</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {group.options.map((opt, idx) => (
          <tr key={opt.id ?? idx}>
            <td className="py-2">{opt.name}</td>
            <td className="py-2 font-mono text-muted-foreground">{opt.sku || '-'}</td>
            <td className="py-2 text-right tabular-nums">
              {opt.price_adjustment !== 0 ? formatCurrency(opt.price_adjustment) : '-'}
            </td>
            <td className="py-2 text-center">{opt.is_default ? 'Yes' : '-'}</td>
            <td className="py-2 text-center">{opt.is_active ? 'Yes' : 'No'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
