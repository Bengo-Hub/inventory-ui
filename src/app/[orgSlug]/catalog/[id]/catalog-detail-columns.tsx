'use client';

// DataTable column definitions for the Catalog item detail page's sub-lists (price
// profiles, serial units, variants) — split out of page.tsx to mirror the platform's
// <page>-columns.tsx convention.

import { Badge } from '@/components/ui/base';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { ItemPricing } from '@/lib/api/pricing';
import type { ItemVariant } from '@/lib/api/items';
import { comboLabel } from '@/lib/inventory/variant-matrix';
import type { SerialRow } from './page';
import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { getActiveTimeZone } from '@/lib/user-timezone';

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
      render: (s) => (s.received_at ? new Date(s.received_at).toLocaleDateString(undefined, { timeZone: getActiveTimeZone() }) : '—'),
    },
    {
      key: 'sold_at',
      header: 'Sold',
      hideBelow: 'sm',
      sortable: true,
      accessor: (s) => s.sold_at ?? '',
      cellClassName: 'text-muted-foreground',
      render: (s) => (s.sold_at ? new Date(s.sold_at).toLocaleDateString(undefined, { timeZone: getActiveTimeZone() }) : '—'),
    },
  ];
}

/** Variants of a parent item. orgSlug builds the link to each variant's own page. */
export function buildVariantColumns(orgSlug: string): DataTableColumn<ItemVariant>[] {
  return [
    {
      key: 'attributes',
      header: 'Variant',
      primary: true,
      accessor: (v) => (v.attributes ? comboLabel(v.attributes) : v.name),
      cellClassName: 'font-medium',
      render: (v) => (
        <Link href={`/${orgSlug}/catalog/${v.id}`} className="hover:text-primary hover:underline">
          {v.attributes && Object.keys(v.attributes).length > 0 ? comboLabel(v.attributes) : v.name}
        </Link>
      ),
    },
    {
      key: 'sku',
      header: 'SKU',
      sortable: true,
      accessor: (v) => v.sku,
      cellClassName: 'font-mono text-xs',
    },
    {
      key: 'barcode',
      header: 'Barcode',
      hideBelow: 'sm',
      accessor: (v) => v.barcode ?? '',
      cellClassName: 'font-mono text-xs text-muted-foreground',
      render: (v) => v.barcode || '—',
    },
    {
      key: 'price',
      header: 'Price',
      align: 'right',
      sortable: true,
      accessor: (v) => v.price,
      cellClassName: 'tabular-nums',
      render: (v) => `KES ${v.price.toLocaleString()}`,
    },
    {
      key: 'on_hand',
      header: 'On hand',
      align: 'right',
      sortable: true,
      accessor: (v) => v.on_hand ?? 0,
      cellClassName: 'tabular-nums',
      render: (v) => (v.on_hand ?? 0).toLocaleString(),
    },
    {
      key: 'is_active',
      header: 'Active',
      hideBelow: 'sm',
      accessor: (v) => (v.is_active ? 'Active' : 'Inactive'),
      render: (v) => <Badge variant={v.is_active ? 'success' : 'outline'}>{v.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
  ];
}
