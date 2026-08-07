'use client';

// DataTable column definitions for the Asset Categories list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Button } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { AssetCategory } from '@/lib/api/assets';

export interface AssetCategoryColumnCallbacks {
  canChange: boolean;
  canDelete: boolean;
  nameOf: (id?: string | null) => string;
  onEdit: (c: AssetCategory) => void;
  onDelete: (c: AssetCategory) => void;
}

export function buildAssetCategoryColumns(cb: AssetCategoryColumnCallbacks): DataTableColumn<AssetCategory>[] {
  return [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      sortable: true,
      accessor: (c) => c.name,
      cellClassName: 'font-medium',
    },
    {
      key: 'parent',
      header: 'Parent',
      hideBelow: 'md',
      accessor: (c) => (c.parent_id ? cb.nameOf(c.parent_id) : ''),
      cellClassName: 'text-muted-foreground',
      render: (c) => (c.parent_id ? cb.nameOf(c.parent_id) : '—'),
    },
    {
      key: 'depreciation_rate',
      header: 'Dep. rate %',
      align: 'right',
      accessor: (c) => c.depreciation_rate ?? 0,
      cellClassName: 'tabular-nums',
    },
    {
      key: 'useful_life_years',
      header: 'Useful life (yrs)',
      align: 'right',
      hideBelow: 'sm',
      accessor: (c) => c.useful_life_years ?? 0,
      cellClassName: 'tabular-nums',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (c) => (
        <div className="flex gap-2 justify-end" onClick={(e) => e.stopPropagation()}>
          {cb.canChange && <Button variant="outline" size="sm" onClick={() => cb.onEdit(c)}>Edit</Button>}
          {cb.canDelete && <Button variant="outline" size="sm" onClick={() => cb.onDelete(c)}>Delete</Button>}
        </div>
      ),
    },
  ];
}
