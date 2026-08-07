'use client';

// DataTable column definitions for the Bundles list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { Trash2 } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Bundle } from '@/lib/api/bundles';

export interface BundleColumnCallbacks {
  onEdit: (bundle: Bundle) => void;
  onDelete: (bundle: Bundle) => void;
}

export function buildBundleColumns(cb: BundleColumnCallbacks): DataTableColumn<Bundle>[] {
  return [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      sortable: true,
      accessor: (b) => b.name,
      render: (b) => <span className="font-medium">{b.name}</span>,
    },
    {
      key: 'item_name',
      header: 'Bundle Item',
      hideBelow: 'sm',
      accessor: (b) => b.item_name ?? b.item_id,
      cellClassName: 'text-sm text-muted-foreground',
    },
    {
      key: 'components',
      header: 'Components',
      hideBelow: 'md',
      accessor: (b) => b.components.length,
      cellClassName: 'text-sm text-muted-foreground',
      render: (b) => `${b.components.length} item${b.components.length !== 1 ? 's' : ''}`,
    },
    {
      key: 'is_active',
      header: 'Status',
      filterable: true,
      accessor: (b) => (b.is_active ? 'Active' : 'Inactive'),
      render: (b) => <Badge variant={b.is_active ? 'success' : 'outline'}>{b.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (bundle) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => cb.onEdit(bundle)}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => cb.onDelete(bundle)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}
