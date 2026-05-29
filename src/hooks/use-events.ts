'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemsApi, type CreateItemInput, type Item, type UpdateItemInput } from '@/lib/api/items';
import { apiClient } from '@/lib/api/client';

const EVENTS_KEY = 'events';

export function useEvents(orgSlug: string, params?: { page?: number; limit?: number }) {
    return useQuery({
        queryKey: [EVENTS_KEY, orgSlug, params],
        queryFn: () => itemsApi.listEvents(orgSlug, params),
        enabled: !!orgSlug,
        staleTime: 30_000,
    });
}

export function useUpdateEventCapacity(orgSlug: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, total_capacity, booked_capacity, event_venue, event_start_at, event_end_at }: {
            id: string;
            total_capacity?: number;
            booked_capacity?: number;
            event_venue?: string;
            event_start_at?: string;
            event_end_at?: string;
        }) =>
            apiClient.put<Item>(`/api/v1/${orgSlug}/inventory/items/${id}`, {
                total_capacity,
                booked_capacity,
                event_venue,
                event_start_at,
                event_end_at,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [EVENTS_KEY, orgSlug] });
        },
    });
}

export function useCancelEvent(orgSlug: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (sku: string) => itemsApi.delete(orgSlug, sku),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [EVENTS_KEY, orgSlug] });
        },
    });
}

export function useCreateEvent(orgSlug: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: CreateItemInput) => itemsApi.create(orgSlug, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [EVENTS_KEY, orgSlug] });
        },
    });
}

export function useUpdateEvent(orgSlug: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ sku, data }: { sku: string; data: UpdateItemInput }) =>
            itemsApi.update(orgSlug, sku, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [EVENTS_KEY, orgSlug] });
        },
    });
}
