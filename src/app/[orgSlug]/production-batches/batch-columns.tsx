'use client';

// DataTable column definitions for the Production Batches list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { ProductionBatch, BatchStatus } from '@/lib/api/productionBatches';
import type { ReactNode } from 'react';
import Link from 'next/link';

export const STATUS_VARIANT: Record<BatchStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  planned: 'outline', in_progress: 'warning', completed: 'success', cancelled: 'error', failed: 'error',
};

export interface BatchColumnCallbacks {
  orgSlug: string;
  workflowActions: (r: ProductionBatch) => ReactNode;
}

export function buildBatchColumns(cb: BatchColumnCallbacks): DataTableColumn<ProductionBatch>[] {
  return [
    {
      key: 'batch_number',
      header: 'Batch #',
      primary: true,
      sortable: true,
      accessor: (r) => r.batch_number,
      cellClassName: 'font-medium',
    },
    {
      key: 'scheduled_date',
      header: 'Scheduled',
      hideBelow: 'lg',
      sortable: true,
      accessor: (r) => r.scheduled_date ?? '',
      render: (r) => (r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString() : '—'),
    },
    {
      key: 'planned_quantity',
      header: 'Planned',
      align: 'right',
      accessor: (r) => r.planned_quantity,
    },
    {
      key: 'actual_quantity',
      header: 'Actual',
      align: 'right',
      hideBelow: 'md',
      accessor: (r) => r.actual_quantity ?? '',
      render: (r) => r.actual_quantity ?? '—',
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      accessor: (r) => r.status,
      render: (r) => <Badge variant={STATUS_VARIANT[r.status]}>{r.status.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (r) => (
        <div className="flex gap-2 justify-end items-center" onClick={(e) => e.stopPropagation()}>
          <Link href={`/${cb.orgSlug}/production-batches/${r.id}`}><Button variant="outline" size="sm">View</Button></Link>
          {cb.workflowActions(r)}
        </div>
      ),
    },
  ];
}
