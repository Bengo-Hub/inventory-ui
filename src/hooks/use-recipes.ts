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
} from '@/lib/api/recipes';

const RECIPES_KEY = 'recipes';

export function useRecipes(orgSlug: string, params?: RecipeListParams) {
    return useQuery<Recipe[]>({
        queryKey: [RECIPES_KEY, orgSlug, params],
        queryFn: () => fetchRecipes(orgSlug, params),
        enabled: !!orgSlug,
        placeholderData: [],
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
