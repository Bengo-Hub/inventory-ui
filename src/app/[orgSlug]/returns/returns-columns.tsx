'use client';

// DataTable column definitions for the Purchase Returns list (supplier returns and repair
// orders) — split out of page.tsx to mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { RowActions } from '@/components/inventory/RowActions';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { PurchaseReturn, ReturnPaymentStatus, ServiceStatus } from '@/lib/api/purchase-returns';
import { formatCalendarDay } from '@/lib/utils';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'outline';

export const STATUS_VARIANT: Record<ReturnPaymentStatus, BadgeVariant> = {
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

export const SERVICE_STATUS_LABEL: Record<ServiceStatus, string> = {
  out: 'Out for repair',
  partial: 'Partly back',
  returned: 'Returned',
  written_off: 'Written off',
};

export const SERVICE_STATUS_VARIANT: Record<ServiceStatus, BadgeVariant> = {
  out: 'warning',
  partial: 'default',
  returned: 'success',
  written_off: 'error',
};

/** The return's own calendar day, never shifted by timezone conversion. */
export const returnDay = (r: PurchaseReturn) => formatCalendarDay(r.date_returned_day || r.date_returned);

/** True while a repair order is still open (some units are at the provider). */
export const isOutForRepair = (r: PurchaseReturn) =>
  r.destination === 'service' && (r.service_status === 'out' || r.service_status === 'partial');

/**
 * An open repair order whose expected day has passed. `today` is the caller's local calendar day
 * (YYYY-MM-DD); both sides are plain day strings, so the comparison never shifts with timezone.
 */
export const isOverdueOrder = (r: PurchaseReturn, today: string) =>
  isOutForRepair(r) && !!r.expected_back_date && r.expected_back_date < today;

/** Status label + variant for a row: the repair state for service orders, the credit state otherwise. */
export function statusOf(r: PurchaseReturn): { label: string; variant: BadgeVariant } {
  if (r.destination === 'service') {
    if (r.service_status) return { label: SERVICE_STATUS_LABEL[r.service_status], variant: SERVICE_STATUS_VARIANT[r.service_status] };
    return { label: STATUS_LABEL.pending, variant: STATUS_VARIANT.pending };
  }
  return { label: STATUS_LABEL[r.payment_status] ?? r.payment_status, variant: STATUS_VARIANT[r.payment_status] };
}

export interface ReturnsColumnCallbacks {
  canChange: boolean;
  /** The caller's local day (YYYY-MM-DD), for the overdue badge. */
  today: string;
  /** Supplier name, or the repair provider for a service order. */
  nameOf: (r: PurchaseReturn) => string;
  onView: (r: PurchaseReturn) => void;
  onApprove: (r: PurchaseReturn) => void;
  onReceive: (r: PurchaseReturn) => void;
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
      key: 'destination',
      header: 'Type',
      hideBelow: 'md',
      accessor: (r) => (r.destination === 'service' ? 'Repair' : 'Supplier return'),
      render: (r) => <Badge variant={r.destination === 'service' ? 'default' : 'outline'}>{r.destination === 'service' ? 'Repair' : 'Supplier return'}</Badge>,
    },
    {
      key: 'supplier_id',
      header: 'Supplier / Sent to',
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
            {isOutForRepair(r) && ` · ${r.outstanding_quantity.toLocaleString()} still out`}
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
      key: 'expected_back_date',
      header: 'Expected back',
      hideBelow: 'lg',
      accessor: (r) => r.expected_back_date || '',
      cellClassName: 'whitespace-nowrap',
      render: (r) => (r.expected_back_date ? formatCalendarDay(r.expected_back_date) : '—'),
    },
    {
      key: 'payment_status',
      header: 'Status',
      sortable: true,
      filterable: true,
      accessor: (r) => statusOf(r).label,
      render: (r) => {
        const st = statusOf(r);
        return (
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant={st.variant}>{st.label}</Badge>
            {isOverdueOrder(r, cb.today) && <Badge variant="error">Overdue</Badge>}
          </div>
        );
      },
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
            cb.canChange && (
              r.payment_status !== 'paid' ? (
                <Button variant="outline" size="sm" onClick={() => cb.onApprove(r)}>
                  {r.destination === 'service' ? 'Send out' : 'Approve'}
                </Button>
              ) : isOutForRepair(r) ? (
                <Button variant="outline" size="sm" onClick={() => cb.onReceive(r)}>
                  Receive back
                </Button>
              ) : null
            )
          }
        />
      ),
    },
  ];
}
