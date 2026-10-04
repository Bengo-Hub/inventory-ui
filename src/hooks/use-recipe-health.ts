'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemsApi, type BulkStatusAction } from '@/lib/api/items';
import { recipeHealthApi, type RecipeHealthIssue } from '@/lib/api/recipe-health';

const KEY = 'recipe-health';

/** One cached summary request shared by the banner on every page and the Recipe Health page. */
export function useRecipeHealthSummary(orgSlug: string, enabled = true) {
  return useQuery({
    queryKey: [KEY, 'summary', orgSlug],
    queryFn: () => recipeHealthApi.summary(orgSlug),
    enabled: !!orgSlug && enabled,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

export function useRecipeHealth(orgSlug: string, issue: RecipeHealthIssue, page: number, limit: number) {
  return useQuery({
    queryKey: [KEY, 'list', orgSlug, issue, page, limit],
    queryFn: () => recipeHealthApi.list(orgSlug, issue, page, limit),
    enabled: !!orgSlug,
    placeholderData: (prev) => prev,
  });
}

function useInvalidateHealth(orgSlug: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: [KEY] });
    qc.invalidateQueries({ queryKey: ['recipes', orgSlug] });
    qc.invalidateQueries({ queryKey: ['items'] });
  };
}

/** Bulk item status change (non-depleting / not-for-sale) from the Recipe Health page. */
export function useRecipeHealthBulkAction(orgSlug: string) {
  const invalidate = useInvalidateHealth(orgSlug);
  return useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: BulkStatusAction }) => itemsApi.bulkStatus(orgSlug, ids, action),
    onSuccess: invalidate,
  });
}

/** Recalculate every recipe's cost from current ingredient costs (publishes to POS/treasury). */
export function useRecomputeAllRecipeCosts(orgSlug: string) {
  const invalidate = useInvalidateHealth(orgSlug);
  return useMutation({
    mutationFn: () => recipeHealthApi.recomputeAll(orgSlug),
    onSuccess: invalidate,
  });
}
