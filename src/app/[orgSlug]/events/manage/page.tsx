'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { SellTicketModal } from '@/components/events/SellTicketModal';
import { ItemFormDialog } from '@/components/inventory/ItemFormDialog';
import { useCancelEvent, useEvents, useUpdateEventCapacity } from '@/hooks/use-events';
import { useUpdateItem } from '@/hooks/useItems';
import type { CreateItemInput, Item } from '@/lib/api/items';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildEventColumns, availableSeats } from './event-columns';
import { Ticket } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';

type Tab = 'upcoming' | 'past' | 'soldout';

// Public ticket storefront base URL (ordering-frontend). Matches the "Online Store" nav convention.
const ORDERING_URL = process.env.NEXT_PUBLIC_ORDERING_UI_URL ?? 'https://ordering.codevertexafrica.com';

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

function EditEventModal({
    event,
    orgSlug,
    onClose,
}: {
    event: Item;
    orgSlug: string;
    onClose: () => void;
}) {
    // Full event editor reuses ItemFormDialog (all fields), with type/category/unit locked to the event.
    const update = useUpdateItem(orgSlug);
    return (
        <ItemFormDialog
            orgSlug={orgSlug}
            item={event}
            lockToEvent
            isPending={update.isPending}
            onClose={onClose}
            onSubmit={(data: CreateItemInput) => {
                update.mutate(
                    { sku: event.sku, data },
                    {
                        onSuccess: () => { toast.success('Event updated'); onClose(); },
                        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update event')),
                    },
                );
            }}
        />
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

    const { data, isLoading, error, isError, refetch } = useEvents(orgSlug, { limit: 200 });
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

    const columns = useMemo(
        () => buildEventColumns({
            isUpdatingCapacity: updateCapacity.isPending,
            onCopyLink: (event) => copyEventLink(orgSlug, event.id),
            onSell: setSellEvent,
            onEdit: setEditEvent,
            onMarkFull: handleMarkFull,
            onCancel: setCancelTarget,
        }),
        [orgSlug, updateCapacity.isPending],
    );

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
                    <div className="px-2 pb-2">
                        <DataTable<Item>
                            columns={columns}
                            rows={filtered}
                            rowKey={(event) => event.id}
                            loading={isLoading}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyState={
                                <>
                                    <Ticket className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                                    <p className="text-muted-foreground">No {tab} events</p>
                                </>
                            }
                            storageKey="manage-events-col-prefs"
                        />
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
