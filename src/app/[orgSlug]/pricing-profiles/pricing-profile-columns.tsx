'use client';

// DataTable column definitions for the Pricing Profiles list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { Pencil, Sparkles, Trash2 } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { PricingTier } from '@/lib/api/pricing';

export interface PricingProfileColumnCallbacks {
  isDeleting: boolean;
  onGenerate: (t: PricingTier) => void;
  onEdit: (t: PricingTier) => void;
  onDelete: (t: PricingTier) => void;
}

export function buildPricingProfileColumns(cb: PricingProfileColumnCallbacks): DataTableColumn<PricingTier>[] {
  return [
    {
      key: 'name',
      header: 'Name',
      primary: true,
      sortable: true,
      accessor: (t) => t.name,
      render: (t) => (
        <span className="font-medium">
          {t.name}
          {t.is_default && <Badge variant="default" className="ml-2">Default</Badge>}
        </span>
      ),
    },
    {
      key: 'code',
      header: 'Code',
      hideBelow: 'md',
      accessor: (t) => t.code || '',
      cellClassName: 'font-mono text-xs text-muted-foreground',
      render: (t) => t.code || '—',
    },
    {
      key: 'description',
      header: 'Description',
      hideBelow: 'lg',
      accessor: (t) => t.description || '',
      cellClassName: 'text-muted-foreground',
      render: (t) => t.description || <span className="text-muted-foreground/40">—</span>,
    },
    {
      key: 'is_active',
      header: 'Status',
      align: 'right',
      hideBelow: 'sm',
      filterable: true,
      accessor: (t) => (t.is_active ? 'Active' : 'Inactive'),
      render: (t) => <Badge variant={t.is_active ? 'success' : 'outline'}>{t.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      key: 'created_at',
      header: 'Added',
      sortable: true,
      hideBelow: 'md',
      accessor: (t) => t.created_at,
      cellClassName: 'text-muted-foreground',
      render: (t) => new Date(t.created_at).toLocaleDateString(),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (t) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="sm" aria-label="Generate prices" title="Bulk-generate item prices for this profile" onClick={() => cb.onGenerate(t)}>
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Edit profile" onClick={() => cb.onEdit(t)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Deactivate profile"
            className="text-destructive hover:text-destructive"
            onClick={() => cb.onDelete(t)}
            disabled={cb.isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];
}
