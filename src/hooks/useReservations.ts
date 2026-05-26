'use client';

import { useQuery } from '@tanstack/react-query';
import { reservationsApi, type ReservationListParams } from '@/lib/api/reservations';

const RESERVATIONS_KEY = 'reservations';

export function useReservations(orgSlug: string, params?: ReservationListParams) {
  return useQuery({
    queryKey: [RESERVATIONS_KEY, orgSlug, params],
    queryFn: () => reservationsApi.list(orgSlug, params),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 15_000,
  });
}

export function useReservation(orgSlug: string, id: string) {
  return useQuery({
    queryKey: [RESERVATIONS_KEY, orgSlug, id],
    queryFn: () => reservationsApi.get(orgSlug, id),
    enabled: !!orgSlug && !!id,
  });
}
