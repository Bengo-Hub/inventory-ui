'use client';

// DataTable column definitions for the Purchase Orders list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import { RowActions } from '@/components/inventory/RowActions';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { PurchaseOrder } from '@/lib/api/purchase-orders';

export const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  draft: 'outline',
  sent: 'default',
  partially_received: 'warning',
  received: 'success',
  cancelled: 'error',
};

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  partially_received: 'Partial',
  received: 'Received',
  cancelled: 'Cancelled',
};

export interface PurchaseOrderColumnCallbacks {
  onView: (po: PurchaseOrder) => void;
  onPrint: (po: PurchaseOrder) => void;
}

// effectivePODate returns the calendar day a PO counts toward in reports/lists — the staff-set
// order_date override (backdated via the New/Amend Purchase Order form) when present, else
// created_at. Mirrors the backend's handlers.effectivePODate so this list never shows "today"
// for an order deliberately entered under an earlier date.
export function effectivePODate(po: { order_date?: string; created_at: string }): string {
  return po.order_date || po.created_at;
}

// isOverriddenPODate reports whether a PO's displayed date was backdated away from the day it
// was actually entered — used to show a small "(entered ...)" note so the real creation
// timestamp is never fully hidden, just no longer the misleading headline.
export function isOverriddenPODate(po: { order_date?: string; created_at: string }): boolean {
  return !!po.order_date && po.order_date.slice(0, 10) !== po.created_at.slice(0, 10);
}

export function buildPurchaseOrderColumns(cb: PurchaseOrderColumnCallbacks): DataTableColumn<PurchaseOrder>[] {
  return [
    {
      key: 'po_number',
      header: 'PO Number',
      primary: true,
      sortable: true,
      accessor: (po) => po.po_number,
      cellClassName: 'font-mono text-xs font-medium',
      render: (po) => po.po_number,
    },
    {
      key: 'supplier_name',
      header: 'Supplier',
      sortable: true,
      filterable: true,
      accessor: (po) => po.supplier_name,
    },
    {
      key: 'warehouse_name',
      header: 'Outlet/Warehouse',
      hideBelow: 'md',
      accessor: (po) => po.warehouse_name || '—',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      filterable: true,
      filterOptions: Object.keys(STATUS_LABEL).map((value) => ({ value: STATUS_LABEL[value] ?? value })),
      accessor: (po) => STATUS_LABEL[po.status] ?? po.status,
      render: (po) => <Badge variant={STATUS_VARIANT[po.status] ?? 'default'}>{STATUS_LABEL[po.status] ?? po.status}</Badge>,
    },
    {
      key: 'total_amount',
      header: 'Total',
      align: 'right',
      sortable: true,
      hideBelow: 'sm',
      accessor: (po) => po.total_amount,
      cellClassName: 'font-semibold tabular-nums',
      render: (po) => po.total_amount.toLocaleString(),
    },
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      hideBelow: 'md',
      accessor: (po) => effectivePODate(po),
      cellClassName: 'text-muted-foreground',
      render: (po) => (
        <div>
          <div>{new Date(effectivePODate(po)).toLocaleDateString()}</div>
          {isOverriddenPODate(po) && (
            <div className="text-[10px] text-amber-600" title={`Entered ${new Date(po.created_at).toLocaleString()}`}>
              entered {new Date(po.created_at).toLocaleDateString()}
            </div>
          )}
        </div>
      ),
    },
    {
      // Who raised this PO — critical for auditing procurement alongside adjustments.
      key: 'created_by_name',
      header: 'User',
      hideBelow: 'lg',
      accessor: (po) => po.created_by_name || '',
      cellClassName: 'text-muted-foreground text-xs',
      render: (po) => po.created_by_name || '—',
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (po) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions onView={() => cb.onView(po)} onPrint={() => cb.onPrint(po)} />
        </div>
      ),
    },
  ];
}
