'use client';

// DataTable column definitions for the Purchase Returns list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { RowActions } from '@/components/inventory/RowActions';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { PurchaseReturn, ReturnPaymentStatus } from '@/lib/api/purchase-returns';
import { formatCalendarDay } from '@/lib/utils';

export const STATUS_VARIANT: Record<ReturnPaymentStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  pending: 'warning',
  due: 'warning',
  partial: 'default',
  paid: 'success',
};

// "paid" is the legacy ERP enum value an approval sets: the goods have gone back and the
// supplier credit note is raised. Shown as what it means to the user.
export const STATUS_LABEL: Record<ReturnPaymentStatus, string> = {
  pending: 'Pending approval',
  due: 'Due',
  partial: 'Partly credited',
  paid: 'Approved',
};

/** The return's own calendar day, never shifted by timezone conversion. */
export const returnDay = (r: PurchaseReturn) => formatCalendarDay(r.date_returned_day || r.date_returned);

export interface ReturnsColumnCallbacks {
  canChange: boolean;
  nameOf: (r: PurchaseReturn) => string;
  onView: (r: PurchaseReturn) => void;
  onApprove: (r: PurchaseReturn) => void;
  onPrint: (r: PurchaseReturn) => void;
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
      key: 'date_returned',
      header: 'Date',
      sortable: true,
      accessor: (r) => r.date_returned_day || r.date_returned,
      cellClassName: 'text-muted-foreground whitespace-nowrap',
      render: (r) => returnDay(r),
    },
    {
      key: 'supplier_id',
      header: 'Supplier',
      hideBelow: 'md',
      accessor: (r) => cb.nameOf(r),
    },
    {
      key: 'warehouse_name',
      header: 'Location',
      hideBelow: 'md',
      filterable: true,
      accessor: (r) => r.warehouse_name || '—',
    },
    {
      key: 'items_summary',
      header: 'Items',
      accessor: (r) => r.items_summary,
      render: (r) => (
        <div className="min-w-0 max-w-xs">
          <p className="truncate text-sm" title={r.items_summary}>{r.items_summary || '—'}</p>
          <p className="text-[11px] text-muted-foreground">
            {r.item_count} item{r.item_count === 1 ? '' : 's'} · {r.total_quantity.toLocaleString()} units
          </p>
        </div>
      ),
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
      accessor: (r) => STATUS_LABEL[r.payment_status] ?? r.payment_status,
      render: (r) => <Badge variant={STATUS_VARIANT[r.payment_status]}>{STATUS_LABEL[r.payment_status] ?? r.payment_status}</Badge>,
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
          onPrint={() => cb.onPrint(r)}
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
