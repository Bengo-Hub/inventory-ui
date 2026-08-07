'use client';

// DataTable column definitions for the Audit Log — split out of page.tsx to mirror the
// platform's <page>-columns.tsx convention.

import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { AuditLogEntry } from '@/lib/api/audit';

// Friendly labels + colour bands for the actions the audit log records.
export const ACTION_META: Record<string, { label: string; cls: string }> = {
  'stock.adjustment': { label: 'Stock adjustment', cls: 'bg-blue-500/15 text-blue-500' },
  'stock.writeoff': { label: 'Write-off', cls: 'bg-red-500/15 text-red-500' },
  'stock.breakdown': { label: 'Breakdown', cls: 'bg-amber-500/15 text-amber-500' },
  'stock.count_approved': { label: 'Count approved', cls: 'bg-green-500/15 text-green-500' },
  'user.outlet_assign': { label: 'Outlet assigned', cls: 'bg-purple-500/15 text-purple-500' },
  'user.outlet_unassign': { label: 'Outlet removed', cls: 'bg-purple-500/15 text-purple-500' },
};

export function buildAuditColumns(): DataTableColumn<AuditLogEntry>[] {
  return [
    {
      key: 'created_at',
      header: 'When',
      primary: true,
      sortable: true,
      accessor: (e) => e.created_at,
      cellClassName: 'whitespace-nowrap text-xs text-muted-foreground',
      render: (e) => new Date(e.created_at).toLocaleString(),
    },
    {
      key: 'action',
      header: 'Action',
      filterable: true,
      accessor: (e) => (ACTION_META[e.action] ?? { label: e.action }).label,
      render: (e) => {
        const meta = ACTION_META[e.action] ?? { label: e.action, cls: 'bg-muted text-muted-foreground' };
        return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${meta.cls}`}>{meta.label}</span>;
      },
    },
    {
      key: 'entity_id',
      header: 'Entity',
      accessor: (e) => e.entity_id || '',
      cellClassName: 'font-mono text-xs',
      render: (e) => e.entity_id || '—',
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortable: true,
      accessor: (e) => e.amount ?? 0,
      cellClassName: 'tabular-nums',
      render: (e) => (e.amount != null ? e.amount.toLocaleString() : '—'),
    },
    {
      key: 'reason',
      header: 'Reason',
      hideBelow: 'sm',
      accessor: (e) => e.reason || '',
      cellClassName: 'text-xs text-muted-foreground max-w-xs truncate',
      render: (e) => e.reason || '—',
    },
  ];
}
