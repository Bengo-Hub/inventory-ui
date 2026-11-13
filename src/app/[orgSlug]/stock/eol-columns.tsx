'use client';

// DataTable column definitions for the Stock page's "End of Life" tab — split out of
// page.tsx to mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { RotateCcw } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Item } from '@/lib/api/items';
import { getActiveTimeZone } from '@/lib/user-timezone';

const DAY_MS = 24 * 60 * 60 * 1000;

// Time left before the hourly purge deletes the item. Items with stock or document history are
// never deleted (they stay hidden here for the audit trail), so they show why instead.
function PurgeCountdown({ item }: { item: Item }) {
  if (!item.eol_purge_at) {
    if (!item.eol_kept_reason) return <span className="text-muted-foreground">—</span>;
    return (
      <span title="Kept for the audit trail. It stays hidden until you restore it.">
        <Badge variant="outline">Kept</Badge>
        <span className="ml-1.5 text-xs text-muted-foreground">{item.eol_kept_reason}</span>
      </span>
    );
  }
  const at = new Date(item.eol_purge_at);
  const left = at.getTime() - Date.now();
  const days = Math.ceil(left / DAY_MS);
  const label = left <= 0 ? 'Due now' : days <= 1 ? 'Under a day' : `${days} days`;
  const variant = left <= 0 || days <= 3 ? 'error' : days <= 7 ? 'warning' : 'default';
  return (
    <span title={`Deleted on ${at.toLocaleString(undefined, { timeZone: getActiveTimeZone() })}`}>
      <Badge variant={variant}>{label}</Badge>
      <span className="ml-1.5 text-xs text-muted-foreground hidden lg:inline">{at.toLocaleDateString(undefined, { timeZone: getActiveTimeZone() })}</span>
    </span>
  );
}

export interface EOLColumnCallbacks {
  canManageEOL: boolean;
  onRestore: (item: Item) => void;
}

export function buildEOLColumns(cb: EOLColumnCallbacks): DataTableColumn<Item>[] {
  return [
    {
      key: 'name',
      header: 'Item',
      primary: true,
      sortable: true,
      accessor: (it) => it.name,
      cellClassName: 'font-medium',
    },
    {
      key: 'sku',
      header: 'SKU',
      hideBelow: 'md',
      accessor: (it) => it.sku,
      cellClassName: 'font-mono text-xs text-muted-foreground',
    },
    {
      key: 'end_of_life_at',
      header: 'Marked EOL',
      hideBelow: 'lg',
      sortable: true,
      accessor: (it) => it.end_of_life_at ?? '',
      cellClassName: 'text-muted-foreground',
      render: (it) => (it.end_of_life_at ? new Date(it.end_of_life_at).toLocaleDateString(undefined, { timeZone: getActiveTimeZone() }) : '—'),
    },
    {
      key: 'eol_purge_at',
      header: 'Deletes in',
      sortable: true,
      // ISO dates sort chronologically; kept items ("Kept: ...") sort after every date and
      // export with their reason.
      accessor: (it) => it.eol_purge_at ?? (it.eol_kept_reason ? `Kept: ${it.eol_kept_reason}` : null),
      render: (it) => <PurgeCountdown item={it} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (it) =>
        cb.canManageEOL ? (
          <div onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" title="Restore" onClick={() => cb.onRestore(it)}>
              <RotateCcw className="h-4 w-4 mr-1" /> Restore
            </Button>
          </div>
        ) : null,
    },
  ];
}
