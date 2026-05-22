import { apiClient } from './client';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface ModifierOption {
    id?: string;
    name: string;
    display_name: string;
    price_adjustment: number;
    sort_order: number;
    is_default: boolean;
    is_active: boolean;
}

export interface ModifierGroup {
    id: string;
    name: string;
    display_name: string;
    min_selections: number;
    max_selections: number;
    is_required: boolean;
    options: ModifierOption[];
    createdAt?: string;
    updatedAt?: string;
}

export interface ModifierGroupPayload {
    name: string;
    display_name: string;
    min_selections: number;
    max_selections: number;
    is_required: boolean;
    options: Omit<ModifierOption, 'id'>[];
}

export interface ModifierGroupListParams {
    search?: string;
    page?: number;
    per_page?: number;
}

/* ── API Functions ─────────────────────────────────────────────────── */

export function fetchModifierGroups(orgSlug: string, params?: ModifierGroupListParams) {
    return apiClient.get<ModifierGroup[]>(`/api/v1/${orgSlug}/inventory/modifier-groups`, params);
}

export function fetchModifierGroup(orgSlug: string, id: string) {
    return apiClient.get<ModifierGroup>(`/api/v1/${orgSlug}/inventory/modifier-groups/${id}`);
}

export function createModifierGroup(orgSlug: string, data: ModifierGroupPayload) {
    return apiClient.post<ModifierGroup>(`/api/v1/${orgSlug}/inventory/modifier-groups`, data);
}

export function updateModifierGroup(orgSlug: string, id: string, data: ModifierGroupPayload) {
    return apiClient.put<ModifierGroup>(`/api/v1/${orgSlug}/inventory/modifier-groups/${id}`, data);
}

export function deleteModifierGroup(orgSlug: string, id: string) {
    return apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/modifier-groups/${id}`);
}
