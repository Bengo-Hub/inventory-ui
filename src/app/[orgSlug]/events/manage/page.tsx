'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SellTicketModal } from '@/components/events/SellTicketModal';
import { useCancelEvent, useEvents, useUpdateEventCapacity } from '@/hooks/use-events';
import type { Item } from '@/lib/api/items';
import { Calendar, MapPin, Pencil, Share2, Ticket, Users, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

type Tab = 'upcoming' | 'past' | 'soldout';

// Public ticket storefront base URL (ordering-frontend). Matches the "Online Store" nav convention.
const ORDERING_URL = process.env.NEXT_PUBLIC_ORDERING_UI_URL ?? 'https://ordersapp.codevertexitsolutions.com';

// copyEventLink copies the public, shareable event ticket page URL for a tenant's event.
function copyEventLink(slug: string, eventId: string) {
    const url = `${ORDERING_URL.replace(/\/$/, '')}/${slug}/event/${eventId}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(url).then(
            () => toast.success('Public ticket link copied'),
            () => toast.error('Could not copy link'),
        );
    }
}

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

function toDatetimeLocal(iso?: string | null): string {
    if (!iso) return '';
    return new Date(iso).toISOString().slice(0, 16);
}

function availableSeats(event: Item): number {
    return Math.max(0, (event.total_capacity ?? 0) - (event.booked_capacity ?? 0));
}

function eventStatus(event: Item): { label: string; variant: 'success' | 'warning' | 'error' | 'outline' } {
    const available = availableSeats(event);
    const total = event.total_capacity ?? 0;
    if (total === 0) return { label: 'No Capacity', variant: 'outline' };
    if (available === 0) return { label: 'Sold Out', variant: 'error' };
    const pct = (event.booked_capacity ?? 0) / total;
    if (pct >= 0.8) return { label: 'Almost Full', variant: 'warning' };
    return { label: 'Available', variant: 'success' };
}

function filterEvents(events: Item[], tab: Tab, now: Date): Item[] {
    return events.filter((e) => {
        const start = e.event_start_at ? new Date(e.event_start_at) : null;
        const available = availableSeats(e);
        const total = e.total_capacity ?? 0;
        if (tab === 'upcoming') return start ? start >= now : true;
        if (tab === 'past') return start ? start < now : false;
        if (tab === 'soldout') return available === 0 && total > 0;
        return true;
    });
}

interface EditForm {
    total_capacity: string;
    booked_capacity: string;
    event_venue: string;
    event_start_at: string;
    event_end_at: string;
}

function EditEventModal({
    event,
    orgSlug,
    onClose,
}: {
    event: Item;
    orgSlug: string;
    onClose: () => void;
}) {
    const [form, setForm] = useState<EditForm>({
        total_capacity: String(event.total_capacity ?? ''),
        booked_capacity: String(event.booked_capacity ?? ''),
        event_venue: event.event_venue ?? '',
        event_start_at: toDatetimeLocal(event.event_start_at),
        event_end_at: toDatetimeLocal(event.event_end_at),
    });

    const update = useUpdateEventCapacity(orgSlug);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const total = form.total_capacity !== '' ? parseInt(form.total_capacity, 10) : undefined;
        const booked = form.booked_capacity !== '' ? parseInt(form.booked_capacity, 10) : undefined;
        if (total !== undefined && (isNaN(total) || total < 0)) {
            toast.error('Total capacity must be a non-negative number');
            return;
        }
        if (booked !== undefined && (isNaN(booked) || booked < 0)) {
            toast.error('Booked capacity must be a non-negative number');
            return;
        }
        if (total !== undefined && booked !== undefined && booked > total) {
            toast.error('Booked cannot exceed total capacity');
            return;
        }
        update.mutate({
            id: event.id,
            total_capacity: total,
            booked_capacity: booked,
            event_venue: form.event_venue || undefined,
            event_start_at: form.event_start_at ? new Date(form.event_start_at).toISOString() : undefined,
            event_end_at: form.event_end_at ? new Date(form.event_end_at).toISOString() : undefined,
        }, {
            onSuccess: () => { toast.success('Event updated'); onClose(); },
            onError: () => toast.error('Failed to update event'),
        });
    }

    function field(key: keyof EditForm) {
        return {
            value: form[key],
            onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((prev) => ({ ...prev, [key]: e.target.value })),
        };
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-md mx-4 rounded-xl border border-border bg-card shadow-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="font-semibold text-base">Edit Event</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <p className="font-medium text-sm">{event.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{event.sku}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium">Total Capacity</label>
                            <Input type="number" min="0" placeholder="0" {...field('total_capacity')} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium">Booked</label>
                            <Input type="number" min="0" placeholder="0" {...field('booked_capacity')} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-medium">Venue</label>
                        <Input placeholder="Event venue or address" {...field('event_venue')} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium">Start</label>
                            <Input type="datetime-local" {...field('event_start_at')} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium">End</label>
                            <Input type="datetime-local" {...field('event_end_at')} />
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="primary" className="flex-1" disabled={update.isPending}>
                            {update.isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}

const TABS: { key: Tab; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'soldout', label: 'Sold Out' },
];

export default function ManageEventsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [tab, setTab] = useState<Tab>('upcoming');
    const [editEvent, setEditEvent] = useState<Item | null>(null);
    const [cancelTarget, setCancelTarget] = useState<Item | null>(null);
    const [sellEvent, setSellEvent] = useState<Item | null>(null);

    const { data, isLoading, error } = useEvents(orgSlug, { limit: 200 });
    const cancelEvent = useCancelEvent(orgSlug);
    const updateCapacity = useUpdateEventCapacity(orgSlug);

    if (error) toast.error('Failed to load events');

    const now = new Date();
    const allEvents = data?.data ?? [];
    const filtered = filterEvents(allEvents, tab, now);

    function handleMarkFull(event: Item) {
        if (!event.total_capacity) return;
        updateCapacity.mutate({
            id: event.id,
            booked_capacity: event.total_capacity,
        }, {
            onSuccess: () => toast.success(`${event.name} marked as sold out`),
            onError: () => toast.error('Failed to update event'),
        });
    }

    function handleConfirmCancel() {
        if (!cancelTarget) return;
        cancelEvent.mutate(cancelTarget.sku, {
            onSuccess: () => {
                toast.success(`${cancelTarget.name} cancelled`);
                setCancelTarget(null);
            },
            onError: () => {
                toast.error('Failed to cancel event');
                setCancelTarget(null);
            },
        });
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Manage Events</h1>
                    <p className="text-muted-foreground mt-1">Edit capacity, track bookings, and cancel events</p>
                </div>
                <div className="flex gap-1 p-1 rounded-xl bg-muted/50 border border-border w-fit">
                    {TABS.map(({ key, label }) => (
                        <button
                            key={key}
                            type="button"
                            onClick={() => setTab(key)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                                tab === key
                                    ? 'bg-card shadow-sm text-foreground'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {label}
                            {key === 'soldout' && (
                                <span className="ml-1.5 text-xs text-muted-foreground">
                                    ({filterEvents(allEvents, 'soldout', now).length})
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Event</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">
                                        <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Date</span>
                                    </th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">
                                        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> Venue</span>
                                    </th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">
                                        <span className="flex items-center justify-end gap-1.5"><Users className="h-3.5 w-3.5" /> Total</span>
                                    </th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Booked</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Available</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading events...
                                        </td>
                                    </tr>
                                ) : filtered.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center">
                                            <Ticket className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                                            <p className="text-muted-foreground">No {tab} events</p>
                                        </td>
                                    </tr>
                                ) : (
                                    filtered.map((event) => {
                                        const available = availableSeats(event);
                                        const status = eventStatus(event);
                                        const isSoldOut = available === 0 && (event.total_capacity ?? 0) > 0;
                                        return (
                                            <tr key={event.id} className="hover:bg-accent/20 transition-colors">
                                                <td className="px-6 py-4">
                                                    <p className="font-medium">{event.name}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{event.sku}</p>
                                                </td>
                                                <td className="px-6 py-4 text-muted-foreground hidden md:table-cell text-xs">
                                                    {formatEventDate(event.event_start_at)}
                                                </td>
                                                <td className="px-6 py-4 text-muted-foreground hidden lg:table-cell max-w-[200px]">
                                                    <span className="truncate block text-xs">{event.event_venue ?? '—'}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums font-medium">
                                                    {event.total_capacity ?? '—'}
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                                                    {event.booked_capacity ?? 0}
                                                </td>
                                                <td className={`px-6 py-4 text-right tabular-nums font-semibold hidden sm:table-cell ${isSoldOut ? 'text-destructive' : available <= (event.total_capacity ?? 0) * 0.2 ? 'text-yellow-600' : 'text-emerald-600'}`}>
                                                    {available}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={status.variant}>{status.label}</Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            title="Copy public ticket link"
                                                            onClick={() => copyEventLink(orgSlug, event.id)}
                                                        >
                                                            <Share2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {(event.total_capacity ?? 0) > 0 && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                title="Sell tickets"
                                                                onClick={() => setSellEvent(event)}
                                                            >
                                                                <Ticket className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            title="Edit event"
                                                            onClick={() => setEditEvent(event)}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        {!isSoldOut && (event.total_capacity ?? 0) > 0 && (
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                title="Mark as sold out"
                                                                onClick={() => handleMarkFull(event)}
                                                                disabled={updateCapacity.isPending}
                                                            >
                                                                Full
                                                            </Button>
                                                        )}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            title="Cancel event"
                                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                            onClick={() => setCancelTarget(event)}
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {editEvent && (
                <EditEventModal
                    event={editEvent}
                    orgSlug={orgSlug}
                    onClose={() => setEditEvent(null)}
                />
            )}

            {sellEvent && (
                <SellTicketModal
                    orgSlug={orgSlug}
                    eventId={sellEvent.id}
                    eventName={sellEvent.name}
                    onClose={() => setSellEvent(null)}
                />
            )}

            <ConfirmDialog
                open={!!cancelTarget}
                title="Cancel Event"
                description={`Are you sure you want to cancel "${cancelTarget?.name ?? ''}"? This action cannot be undone.`}
                variant="danger"
                confirmLabel="Cancel Event"
                onConfirm={handleConfirmCancel}
                onCancel={() => setCancelTarget(null)}
            />
        </div>
    );
}
