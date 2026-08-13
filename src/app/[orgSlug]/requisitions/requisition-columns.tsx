'use client';

// DataTable column definitions for the Requisitions list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Requisition, RequisitionStatus } from '@/lib/api/requisitions';
import type { ReactNode } from 'react';

export const STATUS_VARIANT: Record<RequisitionStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  draft: 'outline', submitted: 'warning', procurement_review: 'warning',
  approved: 'success', rejected: 'error', ordered: 'default', completed: 'success',
};

export interface RequisitionColumnCallbacks {
  workflowActions: (r: Requisition) => ReactNode;
}

export function buildRequisitionColumns(cb: RequisitionColumnCallbacks): DataTableColumn<Requisition>[] {
  return [
    {
      key: 'reference_number',
      header: 'Reference',
      primary: true,
      sortable: true,
      accessor: (r) => r.reference_number,
      cellClassName: 'font-medium',
    },
    {
      key: 'request_type',
      header: 'Type',
      hideBelow: 'md',
      accessor: (r) => r.request_type,
      cellClassName: 'capitalize',
      render: (r) => r.request_type.replace(/_/g, ' '),
    },
    {
      key: 'purpose',
      header: 'Purpose',
      hideBelow: 'lg',
      accessor: (r) => r.purpose,
      cellClassName: 'max-w-xs truncate',
    },
    {
      key: 'priority',
      header: 'Priority',
      accessor: (r) => r.priority,
      cellClassName: 'capitalize',
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      accessor: (r) => r.status,
      render: (r) => <Badge variant={STATUS_VARIANT[r.status]}>{r.status.replace(/_/g, ' ')}</Badge>,
    },
    {
      key: 'created_at',
      header: 'Added',
      sortable: true,
      hideBelow: 'lg',
      accessor: (r) => r.created_at,
      cellClassName: 'text-muted-foreground',
      render: (r) => new Date(r.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (r) => <div onClick={(e) => e.stopPropagation()}>{cb.workflowActions(r)}</div>,
    },
  ];
}
