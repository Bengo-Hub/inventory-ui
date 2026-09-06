'use client';

// DataTable column definitions for the Catalog item detail page's two sub-lists (price
// profiles, serial units) — split out of page.tsx to mirror the platform's
// <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { ItemPricing } from '@/lib/api/pricing';
import type { SerialRow } from './page';
import { Trash2 } from 'lucide-react';

export function buildItemPricingColumns(
  outletName?: (id: string) => string | undefined,
  /** Only outlet-scoped rows get a delete action — the all-outlets default row can't be
   *  deleted this way (there's nothing to "revert" it to; edit it via the Edit modal instead). */
  onDelete?: (row: ItemPricing) => void,
): DataTableColumn<ItemPricing>[] {
  const columns: DataTableColumn<ItemPricing>[] = [
    {
      key: 'tier',
      header: 'Pricing Tier',
      primary: true,
      accessor: (p) => p.tier_name ?? p.tier_code ?? p.pricing_tier_id,
      cellClassName: 'font-medium',
      render: (p) => {
        const label = p.tier_name ?? p.tier_code ?? p.pricing_tier_id;
        if (!p.outlet_id) return label;
        return `${label} (${outletName?.(p.outlet_id) ?? 'outlet'})`;
      },
    },
    {
      key: 'tier_basis',
      header: 'Basis',
      hideBelow: 'sm',
      accessor: (p) => p.tier_basis ?? 'default',
      cellClassName: 'text-muted-foreground capitalize',
      render: (p) => (p.tier_basis ?? 'default').replace(/_/g, ' '),
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      sortable: true,
      accessor: (p) => p.price,
      cellClassName: 'font-semibold tabular-nums',
      render: (p) => `${p.currency ?? 'KES'} ${p.price.toLocaleString()}`,
    },
  ];

  if (onDelete) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      render: (p) =>
        p.outlet_id ? (
          <button
            type="button"
            onClick={() => onDelete(p)}
            className="text-muted-foreground hover:text-destructive transition-colors"
            title="Delete this outlet's price — reverts to the all-outlets price"
            aria-label="Delete outlet price"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null,
    });
  }

  return columns;
}

export function buildSerialColumns(): DataTableColumn<SerialRow>[] {
  return [
    {
      key: 'serial_number',
      header: 'Serial Number',
      primary: true,
      sortable: true,
      accessor: (s) => s.serial_number,
      cellClassName: 'font-mono',
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      accessor: (s) => s.status,
      render: (s) => <Badge variant={s.status === 'available' ? 'success' : 'outline'} className="capitalize">{s.status}</Badge>,
    },
    {
      key: 'received_at',
      header: 'Received',
      hideBelow: 'sm',
      sortable: true,
      accessor: (s) => s.received_at ?? '',
      cellClassName: 'text-muted-foreground',
      render: (s) => (s.received_at ? new Date(s.received_at).toLocaleDateString() : '—'),
    },
    {
      key: 'sold_at',
      header: 'Sold',
      hideBelow: 'sm',
      sortable: true,
      accessor: (s) => s.sold_at ?? '',
      cellClassName: 'text-muted-foreground',
      render: (s) => (s.sold_at ? new Date(s.sold_at).toLocaleDateString() : '—'),
    },
  ];
}
