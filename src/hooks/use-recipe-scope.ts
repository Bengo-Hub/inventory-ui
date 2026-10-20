'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchRecipes } from '@/lib/api/recipes';
import { hasHealthPage, usesRecipes } from '@/lib/use-case-modules';
import { useOutletStore } from '@/store/outlet';

/**
 * Whether the tenant has any recipe at all, from one cheap one-row list request cached for ten
 * minutes. Recipe mutations invalidate every ['recipes', ...] key, so the first recipe a retail
 * tenant creates brings Recipes / BOM into the menu. Not requested for use cases the API would
 * refuse (pharmacy, services).
 */
function useHasRecipes(orgSlug: string, useCase: string | undefined) {
  return useQuery({
    queryKey: ['recipes', orgSlug, 'any'],
    queryFn: async () => (await fetchRecipes(orgSlug, { limit: 1 })).total > 0,
    enabled: !!orgSlug && hasHealthPage(useCase),
    staleTime: 10 * 60_000,
    retry: false,
  });
}

/**
 * What recipe surfaces apply to the current outlet's tenant. `usesRecipes` gates Recipes / BOM and
 * the recipe wording of Recipe Health; `stockHealth` is true when the health page applies at all.
 * Until the recipe check lands a retail tenant reads as "no recipes", so the entries appear rather
 * than flash and vanish.
 */
export function useRecipeScope(orgSlug: string) {
  const useCase = useOutletStore((s) => s.outlet?.use_case);
  const { data: hasRecipes } = useHasRecipes(orgSlug, useCase);
  return {
    useCase,
    usesRecipes: usesRecipes(useCase, !!hasRecipes),
    stockHealth: hasHealthPage(useCase),
  };
}
