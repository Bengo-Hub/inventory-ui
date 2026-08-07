'use client';

// DataTable column definitions for the Warranties list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import { RowActions } from '@/components/inventory/RowActions';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Warranty, WarrantyStatus } from '@/lib/api/warranties';
import type { ReactNode } from 'react';

// active=green, claimed=blue (primary tint), voided=gray, expired=amber
export const STATUS_VARIANT: Record<WarrantyStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  active: 'success', claimed: 'default', voided: 'outline', expired: 'warning',
};

const fmtDate = (s?: string) => (s ? new Date(s).toLocaleDateString() : '—');

export interface WarrantyColumnCallbacks {
  canChange: boolean;
  canDelete: boolean;
  onView: (w: Warranty) => void;
  onEdit: (w: Warranty) => void;
  onDelete: (w: Warranty) => void;
  rowExtra: (w: Warranty) => ReactNode;
}

export function buildWarrantyColumns(cb: WarrantyColumnCallbacks): DataTableColumn<Warranty>[] {
  return [
    {
      key: 'serial_number',
      header: 'Serial',
      primary: true,
      sortable: true,
      accessor: (w) => w.serial_number,
      cellClassName: 'font-mono font-medium',
    },
    {
      key: 'item_name',
      header: 'Item',
      accessor: (w) => w.item_name || '—',
      render: (w) => (
        <div>
          <div className="font-medium">{w.item_name || '—'}</div>
          <div className="text-xs text-muted-foreground font-mono">{w.item_sku}</div>
        </div>
      ),
    },
    {
      key: 'purchase_date',
      header: 'Purchased',
      hideBelow: 'md',
      sortable: true,
      accessor: (w) => w.purchase_date ?? '',
      cellClassName: 'text-muted-foreground',
      render: (w) => fmtDate(w.purchase_date),
    },
    {
      key: 'coverage',
      header: 'Coverage',
      hideBelow: 'lg',
      accessor: (w) => w.warranty_end ?? '',
      cellClassName: 'text-muted-foreground',
      render: (w) => `${fmtDate(w.warranty_start)} – ${fmtDate(w.warranty_end)}`,
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      accessor: (w) => w.status,
      render: (w) => <Badge variant={STATUS_VARIANT[w.status]}>{w.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (w) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onView={() => cb.onView(w)}
            onEdit={() => cb.onEdit(w)}
            canEdit={cb.canChange}
            onDelete={() => cb.onDelete(w)}
            canDelete={cb.canDelete}
            extra={cb.rowExtra(w)}
          />
        </div>
      ),
    },
  ];
}
