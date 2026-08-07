'use client';

// DataTable column definitions for the Stock page's "End of Life" tab — split out of
// page.tsx to mirror the platform's <page>-columns.tsx convention.

import { Button } from '@/components/ui/base';
import { RotateCcw } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Item } from '@/lib/api/items';

export interface EOLColumnCallbacks {
  canManageEOL: boolean;
  onRestore: (item: Item) => void;
}

export function buildEOLColumns(cb: EOLColumnCallbacks): DataTableColumn<Item>[] {
  return [
    {
      key: 'name',
      header: 'Item',
      primary: true,
      sortable: true,
      accessor: (it) => it.name,
      cellClassName: 'font-medium',
    },
    {
      key: 'sku',
      header: 'SKU',
      hideBelow: 'md',
      accessor: (it) => it.sku,
      cellClassName: 'font-mono text-xs text-muted-foreground',
    },
    {
      key: 'end_of_life_at',
      header: 'Marked EOL',
      hideBelow: 'lg',
      sortable: true,
      accessor: (it) => it.end_of_life_at ?? '',
      cellClassName: 'text-muted-foreground',
      render: (it) => (it.end_of_life_at ? new Date(it.end_of_life_at).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (it) =>
        cb.canManageEOL ? (
          <div onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" title="Restore" onClick={() => cb.onRestore(it)}>
              <RotateCcw className="h-4 w-4 mr-1" /> Restore
            </Button>
          </div>
        ) : null,
    },
  ];
}
