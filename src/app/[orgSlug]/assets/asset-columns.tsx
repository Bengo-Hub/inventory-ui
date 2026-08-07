'use client';

// DataTable column definitions for the Fixed Assets list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { RowActions } from '@/components/inventory/RowActions';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Asset, AssetStatus } from '@/lib/api/assets';

export const STATUS_VARIANT: Record<AssetStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  active: 'success', inactive: 'outline', maintenance: 'warning',
  disposed: 'error', lost: 'error', damaged: 'error', retired: 'outline',
};

export function money(v?: number | null) {
  if (v == null) return '—';
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export interface AssetColumnCallbacks {
  canChange: boolean;
  canDelete: boolean;
  onView: (a: Asset) => void;
  onEdit: (a: Asset) => void;
  onDelete: (a: Asset) => void;
  onDepreciate: (a: Asset) => void;
}

export function buildAssetColumns(cb: AssetColumnCallbacks): DataTableColumn<Asset>[] {
  return [
    {
      key: 'asset_tag',
      header: 'Tag',
      sortable: true,
      accessor: (a) => a.asset_tag,
      cellClassName: 'font-medium',
    },
    {
      key: 'name',
      header: 'Name',
      primary: true,
      sortable: true,
      accessor: (a) => a.name,
    },
    {
      key: 'purchase_cost',
      header: 'Cost',
      align: 'right',
      hideBelow: 'md',
      accessor: (a) => a.purchase_cost ?? 0,
      cellClassName: 'tabular-nums',
      render: (a) => money(a.purchase_cost),
    },
    {
      key: 'current_value',
      header: 'Current Value',
      align: 'right',
      hideBelow: 'lg',
      accessor: (a) => a.current_value ?? 0,
      cellClassName: 'tabular-nums',
      render: (a) => money(a.current_value),
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      accessor: (a) => a.status,
      render: (a) => <Badge variant={STATUS_VARIANT[a.status]}>{a.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (a) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onView={() => cb.onView(a)}
            onEdit={() => cb.onEdit(a)}
            canEdit={cb.canChange}
            onDelete={() => cb.onDelete(a)}
            canDelete={cb.canDelete}
            deleteLabel="Dispose / retire"
            extra={cb.canChange && a.status === 'active' && (
              <Button variant="outline" size="sm" onClick={() => cb.onDepreciate(a)}>Depreciate</Button>
            )}
          />
        </div>
      ),
    },
  ];
}
