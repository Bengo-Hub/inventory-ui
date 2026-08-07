'use client';

// DataTable column definitions for the Approvals inbox — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { ApprovalRequest } from '@/lib/api/approvals';

export const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'outline',
};

export interface ApprovalColumnCallbacks {
  moduleLabel: (m: string) => string;
  roleLabel: (code: string) => string;
}

export function buildApprovalColumns(cb: ApprovalColumnCallbacks): DataTableColumn<ApprovalRequest>[] {
  return [
    {
      key: 'object_reference',
      header: 'Document',
      primary: true,
      sortable: true,
      accessor: (r) => r.object_reference || r.object_id.slice(0, 8),
      cellClassName: 'font-mono text-xs font-medium',
    },
    {
      key: 'module',
      header: 'Type',
      filterable: true,
      accessor: (r) => cb.moduleLabel(r.module),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      accessor: (r) => r.amount,
      cellClassName: 'tabular-nums',
      render: (r) => r.amount.toLocaleString(),
    },
    {
      key: 'awaiting',
      header: 'Awaiting',
      hideBelow: 'md',
      accessor: (r) => (r.status === 'pending' && r.current_step ? `${r.current_step.name} · ${cb.roleLabel(r.current_step.approver_role)}` : ''),
      cellClassName: 'text-muted-foreground',
      render: (r) => (r.status === 'pending' && r.current_step ? `${r.current_step.name} · ${cb.roleLabel(r.current_step.approver_role)}` : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      mobileAction: true,
      accessor: (r) => r.status,
      render: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>{r.status}</Badge>,
    },
  ];
}
