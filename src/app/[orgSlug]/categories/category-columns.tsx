'use client';

// DataTable column definitions for the Categories list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { Pencil, Trash2 } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Category } from './page';

export type CategoryRow = Category & { indent?: boolean };

export interface CategoryColumnCallbacks {
  isDeleting: boolean;
  onEdit: (cat: Category) => void;
  onDelete: (cat: Category) => void;
}

export function buildCategoryColumns(cb: CategoryColumnCallbacks): DataTableColumn<CategoryRow>[] {
  return [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      accessor: (c) => c.name,
      render: (c) => (
        <span className="font-medium">
          {c.indent && <span className="text-muted-foreground mr-2">└─</span>}
          {c.name}
        </span>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      hideBelow: 'md',
      accessor: (c) => c.code ?? '',
      cellClassName: 'font-mono text-xs text-muted-foreground',
      render: (c) => c.code ?? <span className="text-muted-foreground/40">—</span>,
    },
    {
      key: 'parent_name',
      header: 'Parent',
      hideBelow: 'lg',
      accessor: (c) => c.parent_name ?? '',
      cellClassName: 'text-muted-foreground',
      render: (c) => c.parent_name ?? <span className="text-muted-foreground/40">Root</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      align: 'right',
      hideBelow: 'sm',
      filterable: true,
      accessor: (c) => (c.is_active ? 'Active' : 'Inactive'),
      render: (c) => <Badge variant={c.is_active ? 'success' : 'outline'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (cat) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" aria-label="Edit category" onClick={() => cb.onEdit(cat)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Delete category"
            className="text-destructive hover:text-destructive"
            onClick={() => cb.onDelete(cat)}
            disabled={cb.isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}
