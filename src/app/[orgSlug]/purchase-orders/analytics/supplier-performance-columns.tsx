'use client';

// DataTable column definitions for the Procurement Analytics "Supplier Performance"
// table — split out of page.tsx to mirror the platform's <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { SupplierPerformance } from '@/lib/api/procurement';

function pct(n: number) { return `${(n * 100).toFixed(0)}%`; }

export interface SupplierPerformanceColumnCallbacks {
  nameOf: (id: string) => string;
}

export function buildSupplierPerformanceColumns(cb: SupplierPerformanceColumnCallbacks): DataTableColumn<SupplierPerformance>[] {
  return [
    {
      key: 'supplier',
      header: 'Supplier',
      primary: true,
      sortable: true,
      accessor: (p) => cb.nameOf(p.supplier_id),
      cellClassName: 'font-medium',
    },
    {
      key: 'on_time_delivery_rate',
      header: 'On-time',
      align: 'right',
      sortable: true,
      accessor: (p) => p.on_time_delivery_rate,
      render: (p) => (
        <Badge variant={p.on_time_delivery_rate >= 0.9 ? 'success' : p.on_time_delivery_rate >= 0.7 ? 'warning' : 'error'}>
          {pct(p.on_time_delivery_rate)}
        </Badge>
      ),
    },
    {
      key: 'defect_rate',
      header: 'Defect rate',
      align: 'right',
      sortable: true,
      accessor: (p) => p.defect_rate,
      cellClassName: 'tabular-nums',
      render: (p) => pct(p.defect_rate),
    },
    {
      key: 'average_lead_time_days',
      header: 'Avg lead (days)',
      align: 'right',
      hideBelow: 'sm',
      sortable: true,
      accessor: (p) => p.average_lead_time_days,
      cellClassName: 'tabular-nums',
      render: (p) => p.average_lead_time_days.toFixed(1),
    },
    {
      key: 'total_spend',
      header: 'Spend',
      align: 'right',
      hideBelow: 'md',
      sortable: true,
      accessor: (p) => p.total_spend,
      cellClassName: 'tabular-nums',
      render: (p) => p.total_spend.toLocaleString(),
    },
  ];
}
