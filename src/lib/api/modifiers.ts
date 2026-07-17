import { apiClient } from './client';

/* ── Types (aligned to inventory-api modifiers module) ─────────────── */

export interface ModifierOption {
    id?: string;
    group_id?: string;
    name: string;
    /** Inventory item SKU deducted when this option is sold (a linked accompaniment /
     *  add-on). A linked RECIPE item deducts its own BOM ingredients. */
    sku?: string;
    price_adjustment: number;
    /** How much of `sku` ONE selection consumes (default 1 natural unit). */
    deduction_qty?: number;
    deduction_unit?: string;
    is_default: boolean;
    is_active: boolean;
    display_order?: number;
}

export interface ModifierGroup {
    id: string;
    item_id: string;
    item_name?: string;
    item_sku?: string;
    name: string;
    min_selections: number;
    max_selections: number;
    is_required: boolean;
    display_order?: number;
    options: ModifierOption[];
    created_at?: string;
    updated_at?: string;
}

export interface ModifierOptionPayload {
    name: string;
    sku?: string;
    price_adjustment: number;
    deduction_qty?: number;
    deduction_unit?: string;
    is_default: boolean;
    is_active: boolean;
    display_order?: number;
}

export interface ModifierGroupPayload {
    item_id: string;
    name: string;
    min_selections: number;
    max_selections: number;
    is_required: boolean;
    /** Full option set — replaces existing options on update. */
    options: ModifierOptionPayload[];
}

export interface ModifierGroupListParams {
    search?: string;
    page?: number;
    limit?: number;
}

export interface PaginatedModifierGroups {
    data: ModifierGroup[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

/* ── API Functions ─────────────────────────────────────────────────── */

export function fetchModifierGroups(orgSlug: string, params?: ModifierGroupListParams): Promise<PaginatedModifierGroups> {
    return apiClient.get<PaginatedModifierGroups>(`/api/v1/${orgSlug}/inventory/modifier-groups`, params);
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
