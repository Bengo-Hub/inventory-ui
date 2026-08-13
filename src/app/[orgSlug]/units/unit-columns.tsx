'use client';

// DataTable column definitions for the Units of Measure list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Button } from '@/components/ui/base';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';

export const TYPE_LABELS: Record<string, string> = {
  weight: 'Weight',
  volume: 'Volume',
  count: 'Count',
  length: 'Length',
  area: 'Area',
  other: 'Other',
};

export interface Unit {
  id: string;
  name: string;
  abbreviation: string;
  type?: string;
  item_count?: number;
  is_active?: boolean;
  created_at?: string;
}

export interface UnitColumnCallbacks {
  isDeleting: boolean;
  onView: (unit: Unit) => void;
  onEdit: (unit: Unit) => void;
  onDelete: (unit: Unit) => void;
}

export function buildUnitColumns(cb: UnitColumnCallbacks): DataTableColumn<Unit>[] {
  return [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      sortable: true,
      accessor: (u) => u.name,
      cellClassName: 'font-medium',
    },
    {
      key: 'abbreviation',
      header: 'Abbreviation',
      sortable: true,
      accessor: (u) => u.abbreviation,
      cellClassName: 'font-mono text-xs font-semibold text-primary',
    },
    {
      key: 'type',
      header: 'Type',
      hideBelow: 'md',
      filterable: true,
      accessor: (u) => TYPE_LABELS[u.type ?? ''] ?? (u.type || ''),
      cellClassName: 'text-muted-foreground capitalize',
      render: (u) => TYPE_LABELS[u.type ?? ''] ?? (u.type || <span className="text-muted-foreground/40">—</span>),
    },
    {
      key: 'item_count',
      header: 'Used by Items',
      align: 'right',
      hideBelow: 'sm',
      sortable: true,
      accessor: (u) => u.item_count ?? 0,
      cellClassName: 'tabular-nums',
      render: (u) => (u.item_count ?? 0).toLocaleString(),
    },
    {
      key: 'created_at',
      header: 'Added',
      sortable: true,
      hideBelow: 'md',
      accessor: (u) => u.created_at ?? '',
      cellClassName: 'text-muted-foreground',
      render: (u) => (u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (unit) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => cb.onView(unit)} title="View details">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => cb.onEdit(unit)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => cb.onDelete(unit)}
            disabled={cb.isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}
