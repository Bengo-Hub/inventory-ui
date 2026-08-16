'use client';

// DataTable column definitions for the RFQs list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import { RowActions } from '@/components/inventory/RowActions';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { RFQ } from '@/lib/api/rfq';

export const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  draft: 'outline',
  sent: 'default',
  closed: 'warning',
  awarded: 'success',
  cancelled: 'error',
};

export interface RfqColumnCallbacks {
  canChange: boolean;
  canDelete: boolean;
  isDeleting: boolean;
  onView: (rfq: RFQ) => void;
  onOpen: (rfq: RFQ) => void;
  onDelete: (rfq: RFQ) => void;
  onPrint: (rfq: RFQ) => void;
}

export function buildRfqColumns(cb: RfqColumnCallbacks): DataTableColumn<RFQ>[] {
  return [
    {
      key: 'rfq_number',
      header: 'RFQ',
      primary: true,
      sortable: true,
      accessor: (r) => r.rfq_number,
      cellClassName: 'font-mono text-xs font-medium',
    },
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      accessor: (r) => r.title || '',
      render: (r) => r.title || '—',
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      accessor: (r) => r.status,
      render: (r) => <Badge variant={STATUS_VARIANT[r.status] ?? 'default'}>{r.status}</Badge>,
    },
    {
      key: 'created_at',
      header: 'Created',
      sortable: true,
      hideBelow: 'md',
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
      render: (rfq) => (
        <div onClick={(e) => e.stopPropagation()}>
          <RowActions
            onView={() => cb.onView(rfq)}
            onPrint={() => cb.onPrint(rfq)}
            onEdit={() => cb.onOpen(rfq)}
            canEdit={cb.canChange}
            editLabel="Open full RFQ"
            onDelete={() => cb.onDelete(rfq)}
            canDelete={cb.canDelete && rfq.status === 'draft'}
            deleteDisabled={cb.isDeleting}
          />
        </div>
      ),
    },
  ];
}
