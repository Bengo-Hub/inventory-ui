'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ticketsApi, type IssueTicketInput, type RedeemTicketInput } from '@/lib/api/tickets';

const TICKETS_KEY = 'tickets';
const AVAILABILITY_KEY = 'event-availability';

export function useEventAvailability(orgSlug: string, eventId: string, enabled = true) {
  return useQuery({
    queryKey: [AVAILABILITY_KEY, orgSlug, eventId],
    queryFn: () => ticketsApi.eventAvailability(orgSlug, eventId),
    enabled: !!orgSlug && !!eventId && enabled,
    staleTime: 15_000,
  });
}

export function useTickets(
  orgSlug: string,
  params?: { event_item_id?: string; status?: string; buyer_id?: string; page?: number; limit?: number },
) {
  return useQuery({
    queryKey: [TICKETS_KEY, orgSlug, params],
    queryFn: () => ticketsApi.list(orgSlug, params),
    enabled: !!orgSlug,
    staleTime: 15_000,
  });
}

export function useIssueTicket(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: IssueTicketInput) => ticketsApi.issue(orgSlug, data),
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: [TICKETS_KEY, orgSlug] });
      qc.invalidateQueries({ queryKey: [AVAILABILITY_KEY, orgSlug, t.event_item_id] });
      qc.invalidateQueries({ queryKey: ['events', orgSlug] });
    },
  });
}

export function useRedeemTicket(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ code, data }: { code: string; data?: RedeemTicketInput }) => ticketsApi.redeem(orgSlug, code, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [TICKETS_KEY, orgSlug] }),
  });
}

export function useCancelTicket(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ticketsApi.cancel(orgSlug, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [TICKETS_KEY, orgSlug] });
      qc.invalidateQueries({ queryKey: [AVAILABILITY_KEY, orgSlug] });
      qc.invalidateQueries({ queryKey: ['events', orgSlug] });
    },
  });
}
