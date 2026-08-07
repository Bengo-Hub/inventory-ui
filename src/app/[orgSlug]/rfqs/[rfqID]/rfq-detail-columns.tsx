'use client';

// DataTable column definitions for the RFQ Detail page's sub-lists (requested items,
// invited suppliers, awards) — split out of page.tsx to mirror the platform's
// <page>-columns.tsx convention. The Quote Comparison matrix is intentionally left as a
// raw table in page.tsx: its columns are generated dynamically (one per submitted
// supplier) and it ends in a grand-total footer row, neither of which DataTable supports.

import { Badge, Button } from '@/components/ui/base';
import { X } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { RFQLine, RFQAward, SupplierResponse } from '@/lib/api/rfq';

export const RESP_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  invited: 'outline', submitted: 'success', declined: 'error',
};

export function buildRfqLineColumns(): DataTableColumn<RFQLine>[] {
  return [
    {
      key: 'item',
      header: 'Item / Description',
      primary: true,
      accessor: (l) => l.item_name || l.description || '—',
    },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      accessor: (l) => l.quantity,
      cellClassName: 'tabular-nums',
    },
    {
      key: 'uom',
      header: 'UoM',
      hideBelow: 'sm',
      accessor: (l) => l.uom || '—',
      cellClassName: 'text-muted-foreground',
    },
  ];
}

export interface RfqSupplierColumnCallbacks {
  canChange: boolean;
  onQuote: (resp: SupplierResponse) => void;
  onDecline: (resp: SupplierResponse) => void;
  onRemove: (resp: SupplierResponse) => void;
}

export function buildRfqSupplierColumns(cb: RfqSupplierColumnCallbacks): DataTableColumn<SupplierResponse>[] {
  return [
    {
      key: 'supplier_name',
      header: 'Supplier',
      primary: true,
      accessor: (r) => r.supplier_name || r.supplier_id.slice(0, 8),
      cellClassName: 'font-medium',
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      accessor: (r) => r.status,
      render: (r) => <Badge variant={RESP_VARIANT[r.status] ?? 'outline'}>{r.status}</Badge>,
    },
    {
      key: 'total',
      header: 'Quote Total',
      align: 'right',
      accessor: (r) => (r.status === 'submitted' ? r.total : 0),
      cellClassName: 'tabular-nums',
      render: (r) => (r.status === 'submitted' ? `${r.currency} ${r.total.toLocaleString()}` : '—'),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (resp) =>
        !cb.canChange ? null : (
          <div className="flex items-center justify-end gap-1 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
            {resp.status !== 'declined' && (
              <Button size="sm" variant="ghost" onClick={() => cb.onQuote(resp)}>
                {resp.status === 'submitted' ? 'Edit Quote' : 'Enter Quote'}
              </Button>
            )}
            {resp.status === 'invited' && (
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => cb.onDecline(resp)}>
                Decline
              </Button>
            )}
            {resp.status === 'invited' && (
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => cb.onRemove(resp)}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ),
    },
  ];
}

export interface RfqAwardColumnCallbacks {
  lineLabel: (rfqLineId: string) => string;
}

export function buildRfqAwardColumns(cb: RfqAwardColumnCallbacks): DataTableColumn<RFQAward>[] {
  return [
    {
      key: 'line',
      header: 'Line',
      primary: true,
      accessor: (a) => cb.lineLabel(a.rfq_line_id),
    },
    {
      key: 'supplier',
      header: 'Supplier',
      accessor: (a) => a.supplier_name || a.supplier_id.slice(0, 8),
    },
    {
      key: 'unit_price',
      header: 'Unit Price',
      align: 'right',
      accessor: (a) => a.unit_price,
      cellClassName: 'tabular-nums',
      render: (a) => a.unit_price.toLocaleString(),
    },
    {
      key: 'quantity',
      header: 'Qty',
      align: 'right',
      accessor: (a) => a.quantity,
      cellClassName: 'tabular-nums',
    },
    {
      key: 'po',
      header: 'PO',
      accessor: (a) => (a.po_id ? 'ordered' : 'pending'),
      render: (a) => (a.po_id ? <Badge variant="success">ordered</Badge> : <Badge variant="outline">pending</Badge>),
    },
  ];
}
