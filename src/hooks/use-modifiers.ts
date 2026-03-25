'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    fetchModifierGroups,
    fetchModifierGroup,
    createModifierGroup,
    updateModifierGroup,
    deleteModifierGroup,
    type ModifierGroup,
    type ModifierGroupPayload,
    type ModifierGroupListParams,
} from '@/lib/api/modifiers';

const MODIFIERS_KEY = 'modifier-groups';

export function useModifierGroups(orgSlug: string, params?: ModifierGroupListParams) {
    return useQuery<ModifierGroup[]>({
        queryKey: [MODIFIERS_KEY, orgSlug, params],
        queryFn: () => fetchModifierGroups(orgSlug, params),
        enabled: !!orgSlug,
        placeholderData: [],
    });
}

export function useModifierGroup(orgSlug: string, id: string) {
    return useQuery<ModifierGroup>({
        queryKey: [MODIFIERS_KEY, orgSlug, id],
        queryFn: () => fetchModifierGroup(orgSlug, id),
        enabled: !!orgSlug && !!id,
    });
}

export function useCreateModifierGroup(orgSlug: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: ModifierGroupPayload) => createModifierGroup(orgSlug, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [MODIFIERS_KEY] });
        },
    });
}

export function useUpdateModifierGroup(orgSlug: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: ModifierGroupPayload }) =>
            updateModifierGroup(orgSlug, id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [MODIFIERS_KEY] });
        },
    });
}

export function useDeleteModifierGroup(orgSlug: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteModifierGroup(orgSlug, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [MODIFIERS_KEY] });
        },
    });
}
