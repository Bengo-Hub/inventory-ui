'use client';

import { Badge, Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { useEvents } from '@/hooks/use-events';
import type { Item } from '@/lib/api/items';
import { Calendar, MapPin, Ticket, Users } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 12;

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

function availableSeats(event: Item): number {
    const total = event.total_capacity ?? 0;
    const booked = event.booked_capacity ?? 0;
    return Math.max(0, total - booked);
}

function capacityPercent(event: Item): number {
    if (!event.total_capacity || event.total_capacity === 0) return 0;
    return Math.min(100, Math.round(((event.booked_capacity ?? 0) / event.total_capacity) * 100));
}

function CapacityBar({ event }: { event: Item }) {
    const pct = capacityPercent(event);
    const isSoldOut = availableSeats(event) === 0 && (event.total_capacity ?? 0) > 0;
    return (
        <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
                <span>{event.booked_capacity ?? 0} booked</span>
                <span>{event.total_capacity ?? 0} total</span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all ${isSoldOut ? 'bg-destructive' : pct > 80 ? 'bg-yellow-500' : 'bg-primary'}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

export default function EventsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [page, setPage] = useState(1);

    const { data, isLoading, error } = useEvents(orgSlug, { page, limit: ITEMS_PER_PAGE });

    if (error) {
        toast.error('Failed to load events');
    }

    const events = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE));

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Events & Experiences</h1>
                    <p className="text-muted-foreground mt-1">Upcoming events and ticketed experiences</p>
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-64 rounded-2xl bg-muted animate-pulse" />
                    ))}
                </div>
            ) : events.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                        <p className="text-muted-foreground">No upcoming events scheduled</p>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {events.map((event) => {
                            const available = availableSeats(event);
                            const soldOut = available === 0 && (event.total_capacity ?? 0) > 0;
                            return (
                                <Card key={event.id} className="flex flex-col">
                                    {event.image_url && (
                                        <div className="relative h-40 overflow-hidden rounded-t-2xl bg-muted">
                                            <img
                                                src={event.image_url}
                                                alt={event.name}
                                                className="w-full h-full object-cover"
                                            />
                                            {soldOut && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                    <Badge variant="error" className="text-sm font-bold px-4 py-1">
                                                        Sold Out
                                                    </Badge>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    <CardContent className="flex-1 flex flex-col gap-3 pt-4">
                                        <div>
                                            <h3 className="font-semibold text-base leading-tight">{event.name}</h3>
                                            {event.description && (
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{event.description}</p>
                                            )}
                                        </div>
                                        <div className="space-y-1.5 text-sm text-muted-foreground">
                                            {event.event_start_at && (
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                                                    <span>{formatEventDate(event.event_start_at)}</span>
                                                </div>
                                            )}
                                            {event.event_venue && (
                                                <div className="flex items-center gap-2">
                                                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                                                    <span className="truncate">{event.event_venue}</span>
                                                </div>
                                            )}
                                            {(event.total_capacity ?? 0) > 0 && (
                                                <div className="flex items-center gap-2">
                                                    <Users className="h-3.5 w-3.5 shrink-0" />
                                                    <span>{available} seats available</span>
                                                </div>
                                            )}
                                        </div>
                                        {(event.total_capacity ?? 0) > 0 && (
                                            <CapacityBar event={event} />
                                        )}
                                        <div className="mt-auto pt-2">
                                            <Button
                                                className="w-full"
                                                disabled={soldOut}
                                                variant={soldOut ? 'outline' : 'primary'}
                                            >
                                                <Ticket className="h-4 w-4 mr-2" />
                                                {soldOut ? 'Sold Out' : 'Book Now'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                    {(data?.total ?? 0) > ITEMS_PER_PAGE && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </>
            )}
        </div>
    );
}
