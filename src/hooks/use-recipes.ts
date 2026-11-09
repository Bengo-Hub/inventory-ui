'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    fetchRecipes,
    fetchRecipe,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    type Recipe,
    type RecipePayload,
    type RecipeListParams,
    type PaginatedRecipes,
} from '@/lib/api/recipes';

const RECIPES_KEY = 'recipes';

const EMPTY_RECIPES: PaginatedRecipes = { data: [], total: 0, page: 1, limit: 20, hasMore: false };

export function useRecipes(orgSlug: string, params?: RecipeListParams) {
    return useQuery<PaginatedRecipes>({
        queryKey: [RECIPES_KEY, orgSlug, params],
        queryFn: ({ signal }) => fetchRecipes(orgSlug, params, signal),
        enabled: !!orgSlug,
        // Keep the previous page while a new search loads; empty only on the first load.
        placeholderData: (previous) => previous ?? EMPTY_RECIPES,
    });
}

export function useRecipe(orgSlug: string, id: string) {
    return useQuery<Recipe>({
        queryKey: [RECIPES_KEY, orgSlug, id],
        queryFn: () => fetchRecipe(orgSlug, id),
        enabled: !!orgSlug && !!id,
    });
}

export function useCreateRecipe(orgSlug: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: RecipePayload) => createRecipe(orgSlug, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [RECIPES_KEY] });
        },
    });
}

export function useUpdateRecipe(orgSlug: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: RecipePayload }) =>
            updateRecipe(orgSlug, id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [RECIPES_KEY] });
        },
    });
}

export function useDeleteRecipe(orgSlug: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => deleteRecipe(orgSlug, id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: [RECIPES_KEY] });
        },
    });
}
