import { apiClient } from './client';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface RecipeIngredient {
    id?: string;
    item_id: string;
    item_sku?: string;
    item_name: string;
    quantity: number;
    unit_of_measure?: string;
    unit_id?: string;
    waste_percent: number;
    notes?: string;
    display_order?: number;
}

export interface Recipe {
    id: string;
    tenant_id?: string;
    sku: string;
    name: string;
    item_name: string;
    item_id?: string;
    output_qty: number;
    servings: number;
    unit_of_measure: string;
    is_active: boolean;
    total_cost?: number | null;
    cost_per_portion?: number | null;
    target_margin_percent?: number | null;
    suggested_price?: number | null;
    prep_time_minutes?: number | null;
    allergens?: string[];
    ingredients: RecipeIngredient[];
}

export interface RecipePayload {
    sku: string;
    name: string;
    item_id?: string;
    output_qty: number;
    unit_of_measure: string;
    is_active: boolean;
    target_margin_percent?: number | null;
    prep_time_minutes?: number | null;
    ingredients: Pick<RecipeIngredient, 'item_id' | 'item_sku' | 'quantity' | 'unit_of_measure' | 'unit_id' | 'waste_percent' | 'notes'>[];
}

export interface RecipeListParams {
    search?: string;
    page?: number;
    limit?: number;
}

export interface PaginatedRecipes {
    data: Recipe[];
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
}

/* ── API Functions ─────────────────────────────────────────────────── */

export function fetchRecipes(orgSlug: string, params?: RecipeListParams): Promise<PaginatedRecipes> {
    return apiClient.get<PaginatedRecipes>(`/api/v1/${orgSlug}/inventory/recipes`, params);
}

export function fetchRecipe(orgSlug: string, id: string) {
    return apiClient.get<Recipe>(`/api/v1/${orgSlug}/inventory/recipes/${id}`);
}

export function createRecipe(orgSlug: string, data: RecipePayload) {
    return apiClient.post<Recipe>(`/api/v1/${orgSlug}/inventory/recipes`, data);
}

export function updateRecipe(orgSlug: string, id: string, data: RecipePayload) {
    return apiClient.put<Recipe>(`/api/v1/${orgSlug}/inventory/recipes/${id}`, data);
}

export function deleteRecipe(orgSlug: string, id: string) {
    return apiClient.delete<void>(`/api/v1/${orgSlug}/inventory/recipes/${id}`);
}
