'use client';

// DataTable column definitions for the Stock Take list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { DocFormatMenu, type DocFormat } from '@/components/inventory/DocFormatMenu';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { StockCount, StockCountStatus } from '@/lib/api/stock-counts';

export const STATUS_VARIANT: Record<StockCountStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  draft: 'outline',
  counting: 'warning',
  review: 'default',
  approved: 'success',
  cancelled: 'error',
};

export const STATUS_LABEL: Record<StockCountStatus, string> = {
  draft: 'Draft',
  counting: 'Counting',
  review: 'In Review',
  approved: 'Approved',
  cancelled: 'Cancelled',
};

export interface StockTakeColumnCallbacks {
  whName: (id?: string | null) => string;
  onPrint: (c: StockCount, format: DocFormat) => void;
}

export function buildStockTakeColumns(cb: StockTakeColumnCallbacks): DataTableColumn<StockCount>[] {
  return [
    {
      key: 'reference',
      header: 'Reference',
      primary: true,
      sortable: true,
      accessor: (c) => c.reference || 'Untitled count',
      render: (c) => (c.reference ? <span className="font-medium">{c.reference}</span> : <span className="text-muted-foreground">Untitled count</span>),
    },
    {
      key: 'warehouse',
      header: 'Location',
      accessor: (c) => cb.whName(c.warehouse_id),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      filterable: true,
      accessor: (c) => STATUS_LABEL[c.status],
      render: (c) => <Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge>,
    },
    {
      key: 'created_at',
      header: 'Started',
      sortable: true,
      hideBelow: 'sm',
      accessor: (c) => c.created_at,
      cellClassName: 'text-muted-foreground',
      render: (c) => new Date(c.created_at).toLocaleDateString(),
    },
    {
      // Line-status breakdown so a manager can tell which sessions still need attention without
      // opening each one — pending (not yet counted) needs finishing, positive/negative variances
      // need review/classification. Hidden entirely when the summary wasn't computed (undefined,
      // e.g. an older cached response) or every count is zero, rather than showing empty badges.
      key: 'variance',
      header: 'Variance',
      hideBelow: 'md',
      accessor: (c) => (c.negative_lines ?? 0) + (c.positive_lines ?? 0) + (c.pending_lines ?? 0),
      render: (c) => {
        const pending = c.pending_lines ?? 0;
        const positive = c.positive_lines ?? 0;
        const negative = c.negative_lines ?? 0;
        if (pending === 0 && positive === 0 && negative === 0) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-wrap items-center gap-1">
            {negative > 0 && (
              <span title={`${negative} line(s) short (counted below system quantity)`}>
                <Badge variant="error" className="text-[10px]">−{negative}</Badge>
              </span>
            )}
            {positive > 0 && (
              <span title={`${positive} line(s) over (counted above system quantity)`}>
                <Badge variant="success" className="text-[10px]">+{positive}</Badge>
              </span>
            )}
            {pending > 0 && (
              <span title={`${pending} line(s) not yet counted`}>
                <Badge variant="warning" className="text-[10px]">{pending} pending</Badge>
              </span>
            )}
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
      render: (c) => (
        <div className="flex items-center justify-end gap-1">
          <DocFormatMenu label="Export" onSelect={(format) => cb.onPrint(c, format)} />
          <Button variant="ghost" size="sm">Open</Button>
        </div>
      ),
    },
  ];
}
