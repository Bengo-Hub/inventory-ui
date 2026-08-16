'use client';

// DataTable column definitions for the Brands list — mirrors category-columns.tsx.

import { Button } from '@/components/ui/base';
import { Pencil, Trash2 } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Brand } from '@/lib/api/brands';

export interface BrandColumnCallbacks {
  isDeleting: boolean;
  onEdit: (brand: Brand) => void;
  onDelete: (brand: Brand) => void;
}

export function buildBrandColumns(cb: BrandColumnCallbacks): DataTableColumn<Brand>[] {
  return [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      accessor: (b) => b.name,
      render: (b) => <span className="font-medium">{b.name}</span>,
    },
    {
      key: 'code',
      header: 'Code',
      hideBelow: 'md',
      accessor: (b) => b.code ?? '',
      cellClassName: 'font-mono text-xs text-muted-foreground',
      render: (b) => b.code || <span className="text-muted-foreground/40">—</span>,
    },
    {
      key: 'description',
      header: 'Description',
      hideBelow: 'lg',
      accessor: (b) => b.description ?? '',
      cellClassName: 'text-muted-foreground',
      render: (b) => b.description || <span className="text-muted-foreground/40">—</span>,
    },
    {
      key: 'sort_order',
      header: 'Sort',
      align: 'right',
      hideBelow: 'sm',
      accessor: (b) => b.sort_order,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (brand) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" aria-label="Edit brand" onClick={() => cb.onEdit(brand)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Delete brand"
            className="text-destructive hover:text-destructive"
            onClick={() => cb.onDelete(brand)}
            disabled={cb.isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}
