'use client';

// DataTable column definitions for the Goods Receipts list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { RowActions } from '@/components/inventory/RowActions';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { GoodsReceipt, GRNStatus } from '@/lib/api/goods-receipts';

export const STATUS_VARIANT: Record<GRNStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  draft: 'warning',
  posted: 'success',
  cancelled: 'error',
};

export interface GoodsReceiptColumnCallbacks {
  canChange: boolean;
  isPosting: boolean;
  poNumberOf: (id: string) => string;
  onView: (g: GoodsReceipt) => void;
  onPost: (g: GoodsReceipt) => void;
  onPrint: (g: GoodsReceipt) => void;
}

export function buildGoodsReceiptColumns(cb: GoodsReceiptColumnCallbacks): DataTableColumn<GoodsReceipt>[] {
  return [
    {
      key: 'grn_number',
      header: 'GRN #',
      primary: true,
      sortable: true,
      accessor: (g) => g.grn_number,
      cellClassName: 'font-medium font-mono text-xs',
      render: (g) => g.grn_number,
    },
    {
      key: 'purchase_order_id',
      header: 'Purchase Order',
      hideBelow: 'md',
      accessor: (g) => cb.poNumberOf(g.purchase_order_id),
      cellClassName: 'font-mono text-xs',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      filterable: true,
      accessor: (g) => g.status,
      render: (g) => <Badge variant={STATUS_VARIANT[g.status]}>{g.status}</Badge>,
    },
    {
      key: 'received_date',
      header: 'Received',
      hideBelow: 'lg',
      accessor: (g) => g.received_date ?? '',
      cellClassName: 'text-muted-foreground',
      render: (g) => (g.received_date ? new Date(g.received_date).toLocaleDateString() : '—'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (g) => (
        <RowActions
          onView={() => cb.onView(g)}
          onPrint={() => cb.onPrint(g)}
          extra={
            cb.canChange && g.status === 'draft' && (
              <Button variant="outline" size="sm" disabled={cb.isPosting} onClick={() => cb.onPost(g)}>
                Post
              </Button>
            )
          }
        />
      ),
    },
  ];
}
