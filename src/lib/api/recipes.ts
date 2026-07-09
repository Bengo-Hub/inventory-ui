import { apiClient } from './client';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface RecipeIngredient {
    id?: string;
    item_id: string;
    item_sku?: string;
    item_name: string;
    item_cost_price?: number | null;
    /** The ingredient item's own base/stock unit — item_cost_price is per this unit. */
    item_unit_id?: string;
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
    kind?: 'menu' | 'bom';
    requires_qc?: boolean;
    total_cost?: number | null;
    cost_per_portion?: number | null;
    target_margin_percent?: number | null;
    suggested_price?: number | null;
    selling_price?: number | null;
    food_cost_pct?: number | null;
    status?: string | null; // "OK - healthy" | "OK - above target FC%" | "LOSS - cost >= price"
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
    kind?: 'menu' | 'bom';
    requires_qc?: boolean;
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

/**
 * Fetch the recipe for a menu/BOM item by its SKU. The list endpoint's ?sku= form returns a
 * raw array (exact match) rather than a paginated envelope, so this tolerates both shapes and
 * returns the single recipe (or null when the item has none / the outlet can't read recipes).
 */
export async function fetchRecipeBySku(orgSlug: string, sku: string): Promise<Recipe | null> {
    const res = await apiClient.get<Recipe[] | PaginatedRecipes>(
        `/api/v1/${orgSlug}/inventory/recipes`,
        { sku },
    );
    const rows = Array.isArray(res) ? res : res?.data ?? [];
    return rows.find((r) => r.sku === sku) ?? rows[0] ?? null;
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

export function recomputeRecipeCost(orgSlug: string, id: string) {
    return apiClient.post<Recipe>(`/api/v1/${orgSlug}/inventory/recipes/${id}/recompute-cost`, {});
}
