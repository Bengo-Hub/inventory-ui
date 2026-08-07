'use client';

// DataTable column definitions for the Catalog item detail page's two sub-lists (price
// profiles, serial units) — split out of page.tsx to mirror the platform's
// <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { ItemPricing } from '@/lib/api/pricing';
import type { SerialRow } from './page';

export function buildItemPricingColumns(): DataTableColumn<ItemPricing>[] {
  return [
    {
      key: 'tier',
      header: 'Pricing Tier',
      primary: true,
      accessor: (p) => p.tier_name ?? p.tier_code ?? p.pricing_tier_id,
      cellClassName: 'font-medium',
      render: (p) => `${p.tier_name ?? p.tier_code ?? p.pricing_tier_id}${p.outlet_id ? ' (outlet)' : ''}`,
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
