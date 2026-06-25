'use client';

import { Button, Card, CardContent } from '@/components/ui/base';
import { ItemFormDialog } from '@/components/inventory/ItemFormDialog';
import { useCreateEvent, useEvents, useUpdateEvent } from '@/hooks/use-events';
import { type CreateItemInput, type Item, type RecurrenceConfig } from '@/lib/api/items';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDate,
  getDay,
  getMonth,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, QrCode } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';

// ── Recurrence helpers ────────────────────────────────────────────────────────

function isNthWeekdayOfMonth(day: Date, weekNum: number, weekDay: number): boolean {
  if (getDay(day) !== weekDay) return false;
  if (weekNum === -1) {
    const nextWeek = addDays(day, 7);
    return getMonth(nextWeek) !== getMonth(day);
  }
  return Math.ceil(getDate(day) / 7) === weekNum;
}

function matchesDay(event: Item, day: Date): boolean {
  const meta = event.metadata as Record<string, unknown> | undefined;
  if (!meta?.is_recurring) {
    if (!event.event_start_at) return false;
    return isSameDay(parseISO(event.event_start_at), day);
  }
  const rc = meta?.recurrence_config as RecurrenceConfig | undefined;
  if (!rc) return false;
  switch (rc.type) {
    case 'daily': return true;
    case 'weekly': return (rc.days ?? []).includes(getDay(day));
    case 'monthly':
      if (rc.monthDay != null) return getDate(day) === rc.monthDay;
      if (rc.weekNum != null && rc.weekDay != null) return isNthWeekdayOfMonth(day, rc.weekNum, rc.weekDay);
      return false;
    case 'yearly':
      return getMonth(day) + 1 === rc.yearMonth && getDate(day) === rc.yearDay;
    default: return false;
  }
}

function buildCalendarDays(month: Date): Date[] {
  const start = startOfMonth(month);
  const end = endOfMonth(month);
  const days = eachDayOfInterval({ start, end });
  const padStart = getDay(start);
  const padEnd = (7 - ((padStart + days.length) % 7)) % 7;
  return [
    ...Array.from({ length: padStart }, (_, i) => subDays(start, padStart - i)),
    ...days,
    ...Array.from({ length: padEnd }, (_, i) => addDays(end, i + 1)),
  ];
}

const DOW_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ── Calendar page ─────────────────────────────────────────────────────────────

export default function EventsPage() {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  // undefined = modal closed, null = create mode, Item = edit mode
  const [modalEvent, setModalEvent] = useState<Item | null | undefined>(undefined);
  const [modalDate, setModalDate] = useState<string | undefined>();

  const { data, isLoading } = useEvents(orgSlug, { limit: 500, page: 1 });
  const createEvent = useCreateEvent(orgSlug);
  const updateEvent = useUpdateEvent(orgSlug);

  const events = data?.data ?? [];
  const calDays = buildCalendarDays(month);

  function openCreate(day?: Date) {
    if (day) {
      const d = new Date(day);
      d.setHours(10, 0, 0, 0);
      setModalDate(d.toISOString());
    } else {
      setModalDate(undefined);
    }
    setModalEvent(null);
  }

  function handleSubmit(data: CreateItemInput) {
    if (modalEvent) {
      updateEvent.mutate(
        { sku: modalEvent.sku, data },
        {
          onSuccess: () => { toast.success('Event updated'); setModalEvent(undefined); },
          onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update event')),
        },
      );
    } else {
      createEvent.mutate(
        { ...data, type: 'SERVICE', tags: [...(data.tags ?? []), 'event'] },
        {
          onSuccess: () => { toast.success('Event created'); setModalEvent(undefined); },
          onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create event')),
        },
      );
    }
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Events & Experiences</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Click a day to schedule, click an event to edit</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/${orgSlug}/events/check-in`}>
            <Button variant="outline" size="sm">
              <QrCode className="h-4 w-4 mr-1.5" />Check-In
            </Button>
          </Link>
          <Button variant="primary" size="sm" onClick={() => openCreate()}>
            <Plus className="h-4 w-4 mr-1.5" />New Event
          </Button>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h2 className="text-lg font-semibold">{format(month, 'MMMM yyyy')}</h2>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-accent transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-0 overflow-hidden">
          {/* Day-of-week headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DOW_HEADERS.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide"
              >
                {d}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="py-24 text-center text-sm text-muted-foreground">Loading events…</div>
          ) : (
            <div className="grid grid-cols-7">
              {calDays.map((day, idx) => {
                const inMonth = isSameMonth(day, month);
                const today = isToday(day);
                const dayEvents = inMonth ? events.filter((e) => matchesDay(e, day)) : [];

                return (
                  <div
                    key={idx}
                    onClick={() => inMonth && openCreate(day)}
                    className={[
                      'min-h-[96px] p-1.5 border-r border-b border-border transition-colors',
                      inMonth
                        ? 'cursor-pointer hover:bg-accent/20'
                        : 'bg-muted/20 cursor-default',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                        today
                          ? 'bg-primary text-primary-foreground'
                          : inMonth
                          ? 'text-foreground'
                          : 'text-muted-foreground/40',
                      ].join(' ')}
                    >
                      {getDate(day)}
                    </span>

                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((event) => {
                        const isRecurring = !!(event.metadata as Record<string, unknown>)?.is_recurring;
                        return (
                          <button
                            key={event.id}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalDate(undefined);
                              setModalEvent(event);
                            }}
                            className="w-full text-left"
                          >
                            <div
                              className={[
                                'px-1.5 py-0.5 rounded text-xs truncate font-medium',
                                isRecurring
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                  : 'bg-primary/15 text-primary',
                              ].join(' ')}
                            >
                              {event.name}
                            </div>
                          </button>
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] text-muted-foreground pl-1">
                          +{dayEvents.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit modal */}
      {modalEvent !== undefined && (
        <ItemFormDialog
          orgSlug={orgSlug}
          item={modalEvent ?? null}
          defaultDate={modalDate}
          lockToEvent
          onClose={() => setModalEvent(undefined)}
          onSubmit={handleSubmit}
          isPending={createEvent.isPending || updateEvent.isPending}
        />
      )}
    </div>
  );
}
