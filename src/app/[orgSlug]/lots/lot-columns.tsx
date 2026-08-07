'use client';

// DataTable column definitions for the Lots & Batches list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Lot } from '@/lib/api/lots';

const EXPIRY_WARNING_DAYS = 30;

export function isExpiringSoon(expiryDate?: string): boolean {
  if (!expiryDate) return false;
  const expiry = new Date(expiryDate);
  const threshold = new Date();
  threshold.setDate(threshold.getDate() + EXPIRY_WARNING_DAYS);
  return expiry <= threshold && expiry > new Date();
}

export function isExpired(expiryDate?: string): boolean {
  if (!expiryDate) return false;
  return new Date(expiryDate) <= new Date();
}

export interface LotColumnCallbacks {
  isDeleting: boolean;
  onEdit: (lot: Lot) => void;
  onDelete: (lot: Lot) => void;
}

export function buildLotColumns(cb: LotColumnCallbacks): DataTableColumn<Lot>[] {
  return [
    {
      key: 'lot_number',
      header: 'Lot Number',
      primary: true,
      sortable: true,
      accessor: (l) => l.lot_number,
      cellClassName: 'font-mono text-xs font-medium',
    },
    {
      key: 'item_name',
      header: 'Item',
      sortable: true,
      filterable: true,
      accessor: (l) => l.item_name ?? '—',
      render: (l) => (
        <div>
          <div>{l.item_name ?? '—'}</div>
          {l.item_sku && <div className="text-xs text-muted-foreground font-mono">{l.item_sku}</div>}
        </div>
      ),
    },
    {
      key: 'warehouse_name',
      header: 'Warehouse',
      hideBelow: 'md',
      filterable: true,
      accessor: (l) => l.warehouse_name ?? '—',
      cellClassName: 'text-muted-foreground',
    },
    {
      key: 'expiry_date',
      header: 'Expiry Date',
      sortable: true,
      accessor: (l) => l.expiry_date ?? '',
      render: (l) => {
        const expiring = isExpiringSoon(l.expiry_date);
        const expired = isExpired(l.expiry_date);
        if (!l.expiry_date) return <span className="text-muted-foreground">N/A</span>;
        return (
          <div className="flex items-center gap-2">
            <span className={expired ? 'text-red-500 font-medium' : expiring ? 'text-yellow-500 font-medium' : ''}>
              {new Date(l.expiry_date).toLocaleDateString()}
            </span>
            {(expiring || expired) && (
              <AlertTriangle className={`h-3.5 w-3.5 ${expired ? 'text-red-500' : 'text-yellow-500'}`} />
            )}
          </div>
        );
      },
    },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      sortable: true,
      hideBelow: 'sm',
      accessor: (l) => l.quantity,
      cellClassName: 'font-semibold tabular-nums',
      render: (l) => l.quantity.toLocaleString(),
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      accessor: (l) => (isExpired(l.expiry_date) ? 'Expired' : isExpiringSoon(l.expiry_date) ? 'Expiring Soon' : 'Active'),
      render: (l) => {
        const expiring = isExpiringSoon(l.expiry_date);
        const expired = isExpired(l.expiry_date);
        const statusVariant: 'success' | 'warning' | 'error' | 'default' = expired ? 'error' : expiring ? 'warning' : 'success';
        const statusLabel = expired ? 'Expired' : expiring ? 'Expiring Soon' : 'Active';
        return <Badge variant={statusVariant}>{statusLabel}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (lot) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" onClick={() => cb.onEdit(lot)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => cb.onDelete(lot)}
            disabled={cb.isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}
