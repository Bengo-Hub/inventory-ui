'use client';

// DataTable column definitions for the Supplier Contracts list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { RowActions } from '@/components/inventory/RowActions';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Contract, ContractStatus } from '@/lib/api/contracts';

export const STATUS_VARIANT: Record<ContractStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  draft: 'outline', active: 'success', expired: 'warning', terminated: 'error',
};

export interface ContractColumnCallbacks {
  nameOf: (id?: string | null) => string;
  canChange: boolean;
  onView: (c: Contract) => void;
  onEdit: (c: Contract) => void;
  onActivate: (c: Contract) => void;
  onTerminate: (c: Contract) => void;
}

export function buildContractColumns(cb: ContractColumnCallbacks): DataTableColumn<Contract>[] {
  return [
    {
      key: 'title',
      header: 'Title',
      primary: true,
      sortable: true,
      accessor: (c) => c.title,
      cellClassName: 'font-medium',
    },
    {
      key: 'supplier',
      header: 'Supplier',
      hideBelow: 'md',
      accessor: (c) => cb.nameOf(c.supplier_id),
    },
    {
      key: 'value',
      header: 'Value',
      align: 'right',
      sortable: true,
      accessor: (c) => c.value ?? 0,
      cellClassName: 'tabular-nums',
      render: (c) => c.value?.toLocaleString() ?? '—',
    },
    {
      key: 'period',
      header: 'Period',
      hideBelow: 'lg',
      accessor: (c) => c.start_date,
      cellClassName: 'text-muted-foreground',
      render: (c) => `${new Date(c.start_date).toLocaleDateString()} – ${new Date(c.end_date).toLocaleDateString()}`,
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      accessor: (c) => c.status,
      render: (c) => <Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onView={() => cb.onView(c)}
            onEdit={() => cb.onEdit(c)}
            canEdit={cb.canChange}
            extra={
              <>
                {cb.canChange && c.status !== 'active' && c.status !== 'terminated' && (
                  <Button variant="outline" size="sm" onClick={() => cb.onActivate(c)}>Activate</Button>
                )}
                {cb.canChange && c.status === 'active' && (
                  <Button variant="outline" size="sm" onClick={() => cb.onTerminate(c)}>Terminate</Button>
                )}
              </>
            }
          />
        </div>
      ),
    },
  ];
}
