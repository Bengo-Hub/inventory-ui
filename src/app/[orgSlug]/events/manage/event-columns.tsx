'use client';

// DataTable column definitions for the Manage Events list — split out of page.tsx to
// mirror the platform's <page>-columns.tsx convention.

import { Badge, Button } from '@/components/ui/base';
import { Calendar, MapPin, Pencil, Share2, Ticket, Users, X } from 'lucide-react';
import type { DataTableColumn } from '@bengo-hub/shared-ui-lib/data-table';
import type { Item } from '@/lib/api/items';

function formatEventDate(iso?: string | null): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function availableSeats(event: Item): number {
  return Math.max(0, (event.total_capacity ?? 0) - (event.booked_capacity ?? 0));
}

export function eventStatus(event: Item): { label: string; variant: 'success' | 'warning' | 'error' | 'outline' } {
  const available = availableSeats(event);
  const total = event.total_capacity ?? 0;
  if (total === 0) return { label: 'No Capacity', variant: 'outline' };
  if (available === 0) return { label: 'Sold Out', variant: 'error' };
  const pct = (event.booked_capacity ?? 0) / total;
  if (pct >= 0.8) return { label: 'Almost Full', variant: 'warning' };
  return { label: 'Available', variant: 'success' };
}

export interface EventColumnCallbacks {
  isUpdatingCapacity: boolean;
  onCopyLink: (event: Item) => void;
  onSell: (event: Item) => void;
  onEdit: (event: Item) => void;
  onMarkFull: (event: Item) => void;
  onCancel: (event: Item) => void;
}

export function buildEventColumns(cb: EventColumnCallbacks): DataTableColumn<Item>[] {
  return [
    {
      key: 'name',
      header: 'Event',
      primary: true,
      sortable: true,
      accessor: (e) => e.name,
      render: (e) => (
        <div>
          <p className="font-medium">{e.name}</p>
          <p className="text-xs text-muted-foreground font-mono">{e.sku}</p>
        </div>
      ),
    },
    {
      key: 'event_start_at',
      header: (
        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Date</span>
      ),
      hideBelow: 'md',
      sortable: true,
      accessor: (e) => e.event_start_at ?? '',
      cellClassName: 'text-muted-foreground text-xs',
      render: (e) => formatEventDate(e.event_start_at),
    },
    {
      key: 'event_venue',
      header: (
        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Venue</span>
      ),
      hideBelow: 'lg',
      accessor: (e) => e.event_venue ?? '',
      cellClassName: 'max-w-[200px]',
      render: (e) => <span className="truncate block text-xs text-muted-foreground">{e.event_venue ?? '—'}</span>,
    },
    {
      key: 'total_capacity',
      header: (
        <span className="flex items-center justify-end gap-1.5"><Users className="h-3.5 w-3.5" /> Total</span>
      ),
      align: 'right',
      sortable: true,
      accessor: (e) => e.total_capacity ?? 0,
      cellClassName: 'tabular-nums font-medium',
      render: (e) => e.total_capacity ?? '—',
    },
    {
      key: 'booked_capacity',
      header: 'Booked',
      align: 'right',
      hideBelow: 'sm',
      sortable: true,
      accessor: (e) => e.booked_capacity ?? 0,
      cellClassName: 'tabular-nums text-muted-foreground',
    },
    {
      key: 'available',
      header: 'Available',
      align: 'right',
      hideBelow: 'sm',
      sortable: true,
      accessor: (e) => availableSeats(e),
      render: (e) => {
        const available = availableSeats(e);
        const isSoldOut = available === 0 && (e.total_capacity ?? 0) > 0;
        const cls = isSoldOut ? 'text-destructive' : available <= (e.total_capacity ?? 0) * 0.2 ? 'text-yellow-600' : 'text-emerald-600';
        return <span className={`tabular-nums font-semibold ${cls}`}>{available}</span>;
      },
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      accessor: (e) => eventStatus(e).label,
      render: (e) => {
        const status = eventStatus(e);
        return <Badge variant={status.variant}>{status.label}</Badge>;
      },
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      exportable: false,
      mobileAction: true,
      render: (event) => {
        const available = availableSeats(event);
        const isSoldOut = available === 0 && (event.total_capacity ?? 0) > 0;
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            <Button size="sm" variant="ghost" title="Copy public ticket link" onClick={() => cb.onCopyLink(event)}>
              <Share2 className="h-3.5 w-3.5" />
            </Button>
            {(event.total_capacity ?? 0) > 0 && (
              <Button size="sm" variant="ghost" title="Sell tickets" onClick={() => cb.onSell(event)}>
                <Ticket className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="sm" variant="ghost" title="Edit event" onClick={() => cb.onEdit(event)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {!isSoldOut && (event.total_capacity ?? 0) > 0 && (
              <Button size="sm" variant="outline" title="Mark as sold out" onClick={() => cb.onMarkFull(event)} disabled={cb.isUpdatingCapacity}>
                Full
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              title="Cancel event"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => cb.onCancel(event)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      },
    },
  ];
}
