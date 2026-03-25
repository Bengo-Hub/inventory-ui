import { apiClient } from './client';

/* ── Types ─────────────────────────────────────────────────────────── */

export interface RecipeIngredient {
    id?: string;
    item_id: string;
    item_name?: string;
    quantity: number;
    unit_id: string;
    unit_name?: string;
    waste_percent: number;
    cost?: number;
}

export interface Recipe {
    id: string;
    name: string;
    description: string;
    itemId: string;
    itemName?: string;
    total_cost: number;
    cost_per_portion: number;
    target_margin_percent: number;
    suggested_price: number;
    servings: number;
    ingredients: RecipeIngredient[];
    createdAt?: string;
    updatedAt?: string;
}

export interface RecipePayload {
    name: string;
    description: string;
    itemId: string;
    target_margin_percent: number;
    servings: number;
    ingredients: Omit<RecipeIngredient, 'id' | 'item_name' | 'unit_name' | 'cost'>[];
}

export interface RecipeListParams {
    search?: string;
    page?: number;
    per_page?: number;
}

/* ── API Functions ─────────────────────────────────────────────────── */

export function fetchRecipes(orgSlug: string, params?: RecipeListParams) {
    return apiClient.get<Recipe[]>(`/api/v1/tenants/${orgSlug}/inventory/recipes`, params);
}

export function fetchRecipe(orgSlug: string, id: string) {
    return apiClient.get<Recipe>(`/api/v1/tenants/${orgSlug}/inventory/recipes/${id}`);
}

export function createRecipe(orgSlug: string, data: RecipePayload) {
    return apiClient.post<Recipe>(`/api/v1/tenants/${orgSlug}/inventory/recipes`, data);
}

export function updateRecipe(orgSlug: string, id: string, data: RecipePayload) {
    return apiClient.put<Recipe>(`/api/v1/tenants/${orgSlug}/inventory/recipes/${id}`, data);
}

export function deleteRecipe(orgSlug: string, id: string) {
    return apiClient.delete<void>(`/api/v1/tenants/${orgSlug}/inventory/recipes/${id}`);
}
