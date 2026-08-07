'use client';

// DataTable column definitions for the Manufacturing Analytics "Recent Batches" table —
// split out of page.tsx to mirror the platform's <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { ManufacturingDashboard } from '@/lib/api/productionBatches';

export type RecentBatch = ManufacturingDashboard['recent_batches'][number];

export const STATUS_LABEL: Record<string, string> = {
  planned: 'Planned', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', failed: 'Failed',
};
export const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  planned: 'outline', in_progress: 'warning', completed: 'success', cancelled: 'error', failed: 'error',
};

export function buildRecentBatchColumns(): DataTableColumn<RecentBatch>[] {
  return [
    {
      key: 'batch_number',
      header: 'Batch #',
      primary: true,
      sortable: true,
      accessor: (b) => b.batch_number,
      cellClassName: 'font-mono text-xs',
    },
    {
      key: 'planned_quantity',
      header: 'Planned',
      align: 'right',
      accessor: (b) => b.planned_quantity,
      cellClassName: 'tabular-nums',
    },
    {
      key: 'actual_quantity',
      header: 'Actual',
      align: 'right',
      accessor: (b) => b.actual_quantity ?? '',
      cellClassName: 'tabular-nums',
      render: (b) => b.actual_quantity ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      accessor: (b) => b.status,
      render: (b) => <Badge variant={STATUS_VARIANT[b.status] ?? 'outline'}>{STATUS_LABEL[b.status] ?? b.status}</Badge>,
    },
  ];
}
