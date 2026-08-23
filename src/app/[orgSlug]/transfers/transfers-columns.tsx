'use client';

// DataTable column definitions for the Stock Transfers list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import { RowActions } from '@/components/inventory/RowActions';
import { Package } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { TransferSummary } from '@/lib/api/transfers';

export const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
  draft: 'outline',
  pending: 'outline',
  in_transit: 'warning',
  received: 'success',
  cancelled: 'error',
};

// UI vocabulary mirrors the standard stock-transfer lifecycle (Pending → In Transit → Completed).
// The API enum (draft/in_transit/received/cancelled) is unchanged — only the display labels map.
export const STATUS_LABEL: Record<string, string> = {
  draft: 'Pending',
  pending: 'Pending',
  in_transit: 'In Transit',
  received: 'Completed',
  cancelled: 'Cancelled',
};

export interface TransferColumnCallbacks {
  onView: (t: TransferSummary) => void;
  onEdit: (t: TransferSummary) => void;
}

// effectiveTransferDate returns the calendar day a transfer counts toward in reports/lists — the
// staff-set transfer_date override (backdated or postdated via the New/Edit Transfer form) when
// present, else created_at. Mirrors the backend's transfers.EffectiveTransferDate so this list
// never shows "today" for a transfer that was deliberately entered under a different date.
export function effectiveTransferDate(t: { transfer_date?: string; created_at: string }): string {
  return t.transfer_date || t.created_at;
}

// isOverriddenTransferDate reports whether a transfer's displayed date was overridden away from
// the day it was actually entered — used to show a small "(entered ...)" note so the real
// creation timestamp is never fully hidden, just no longer the misleading headline.
export function isOverriddenTransferDate(t: { transfer_date?: string; created_at: string }): boolean {
  return !!t.transfer_date && t.transfer_date.slice(0, 10) !== t.created_at.slice(0, 10);
}

// isoDateOffset/TODAY_STR/TRANSFER_DATE_MIN/MAX back the New/Edit Transfer dialogs' date input —
// bounds mirror the backend's maxTransferDateBackDays/maxTransferDateForwardDays (inventory-api
// transfers/service.go); the input's min/max just gives immediate feedback, the server is the
// real enforcement point.
export function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
export const TODAY_STR = isoDateOffset(0);
export const TRANSFER_DATE_MIN = isoDateOffset(-366);
export const TRANSFER_DATE_MAX = isoDateOffset(366);

export function buildTransferColumns(cb: TransferColumnCallbacks): DataTableColumn<TransferSummary>[] {
  return [
    {
      key: 'transfer_number',
      header: 'Reference',
      primary: true,
      sortable: true,
      accessor: (t) => t.transfer_number,
      cellClassName: 'font-mono text-xs',
      render: (t) => t.transfer_number,
    },
    {
      key: 'source_warehouse_name',
      header: 'From',
      sortable: true,
      accessor: (t) => t.source_warehouse_name || '—',
    },
    {
      key: 'destination_warehouse_name',
      header: 'To',
      sortable: true,
      accessor: (t) => t.destination_warehouse_name || '—',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      filterable: true,
      accessor: (t) => STATUS_LABEL[t.status] ?? t.status,
      render: (t) => (
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[t.status] ?? 'default'}>{STATUS_LABEL[t.status] ?? t.status}</Badge>
          {t.origin !== 'manual' && (
            <span title="Auto-recorded from a bulk stock adjustment, not created via New Transfer">
              <Badge variant="outline">Auto</Badge>
            </span>
          )}
          <div className="flex items-center gap-1 text-muted-foreground text-xs">
            <Package className="h-3 w-3" />
            {t.line_count}
          </div>
        </div>
      ),
    },
    {
      key: 'created_at',
      header: 'Date',
      sortable: true,
      hideBelow: 'md',
      accessor: (t) => effectiveTransferDate(t),
      cellClassName: 'text-muted-foreground',
      render: (t) => (
        <div>
          <div>{new Date(effectiveTransferDate(t)).toLocaleDateString()}</div>
          {isOverriddenTransferDate(t) && (
            <div className="text-[10px] text-amber-600" title={`Entered ${new Date(t.created_at).toLocaleString()}`}>
              entered {new Date(t.created_at).toLocaleDateString()}
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (t) => (
        <RowActions
          onView={() => cb.onView(t)}
          onEdit={() => cb.onEdit(t)}
          canEdit={t.status === 'draft'}
        />
      ),
    },
  ];
}
