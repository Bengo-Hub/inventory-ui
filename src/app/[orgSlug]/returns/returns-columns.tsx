'use client';

// DataTable column definitions for the Purchase Returns list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { RowActions } from '@/components/inventory/RowActions';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { PurchaseReturn, ReturnPaymentStatus } from '@/lib/api/purchase-returns';

export const STATUS_VARIANT: Record<ReturnPaymentStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  pending: 'warning',
  due: 'warning',
  partial: 'default',
  paid: 'success',
};

export interface ReturnsColumnCallbacks {
  canChange: boolean;
  nameOf: (id?: string | null) => string;
  onView: (r: PurchaseReturn) => void;
  onApprove: (r: PurchaseReturn) => void;
}

export function buildReturnsColumns(cb: ReturnsColumnCallbacks): DataTableColumn<PurchaseReturn>[] {
  return [
    {
      key: 'return_number',
      header: 'Return #',
      primary: true,
      sortable: true,
      accessor: (r) => r.return_number,
      cellClassName: 'font-medium font-mono text-xs',
      render: (r) => r.return_number,
    },
    {
      key: 'supplier_id',
      header: 'Supplier',
      hideBelow: 'md',
      accessor: (r) => cb.nameOf(r.supplier_id),
    },
    {
      key: 'return_amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      accessor: (r) => r.return_amount,
      cellClassName: 'tabular-nums',
      render: (r) => r.return_amount.toLocaleString(),
    },
    {
      key: 'payment_status',
      header: 'Status',
      sortable: true,
      filterable: true,
      accessor: (r) => r.payment_status,
      render: (r) => <Badge variant={STATUS_VARIANT[r.payment_status]}>{r.payment_status}</Badge>,
    },
    {
      key: 'date_returned',
      header: 'Date',
      hideBelow: 'lg',
      accessor: (r) => r.date_returned,
      cellClassName: 'text-muted-foreground',
      render: (r) => new Date(r.date_returned).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (r) => (
        <RowActions
          onView={() => cb.onView(r)}
          extra={
            cb.canChange && r.payment_status !== 'paid' && (
              <Button variant="outline" size="sm" onClick={() => cb.onApprove(r)}>
                Approve
              </Button>
            )
          }
        />
      ),
    },
  ];
}
