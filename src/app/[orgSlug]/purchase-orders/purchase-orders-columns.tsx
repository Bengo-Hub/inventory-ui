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
      accessor: (po) => po.created_at,
      cellClassName: 'text-muted-foreground',
      render: (po) => new Date(po.created_at).toLocaleDateString(),
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
