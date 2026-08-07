'use client';

// DataTable column definitions for the Batch Detail page's two sub-lists (materials
// consumed, quality checks) — split out of page.tsx to mirror the platform's
// <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { BatchMaterial, QualityCheckRec } from '@/lib/api/productionBatches';

const money = (n?: number | null) => (n != null ? n.toLocaleString() : '—');

export function buildBatchMaterialColumns(): DataTableColumn<BatchMaterial>[] {
  return [
    {
      key: 'item_id',
      header: 'Item',
      primary: true,
      accessor: (m) => m.item_id,
      cellClassName: 'font-mono text-xs',
      render: (m) => m.item_id.slice(0, 8),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      accessor: (m) => m.quantity,
      cellClassName: 'tabular-nums',
    },
    {
      key: 'cost',
      header: 'Cost',
      align: 'right',
      accessor: (m) => m.cost,
      cellClassName: 'tabular-nums',
      render: (m) => money(m.cost),
    },
  ];
}

export function buildBatchQCColumns(): DataTableColumn<QualityCheckRec>[] {
  return [
    {
      key: 'check_date',
      header: 'Date',
      primary: true,
      accessor: (q) => q.check_date ?? '',
      render: (q) => (q.check_date ? new Date(q.check_date).toLocaleDateString() : '—'),
    },
    {
      key: 'result',
      header: 'Result',
      filterable: true,
      accessor: (q) => q.result,
      render: (q) => <Badge variant={q.result === 'pass' ? 'success' : q.result === 'fail' ? 'error' : 'warning'}>{q.result}</Badge>,
    },
    {
      key: 'notes',
      header: 'Notes',
      accessor: (q) => q.notes || '',
      cellClassName: 'text-muted-foreground',
      render: (q) => q.notes || '—',
    },
  ];
}
