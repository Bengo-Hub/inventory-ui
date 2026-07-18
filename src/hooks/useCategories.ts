'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '@/lib/api/categories';
import { useOutletStore } from '@/store/outlet';

const CATEGORIES_KEY = 'categories';

// Categories are scoped to the selected outlet's use_case (untagged categories
// are universal). HQ "All Outlets" (no use_case) sees everything.
export function useCategories(orgSlug: string, opts?: { hasItems?: boolean }) {
  const hasItems = opts?.hasItems ?? false;
  const useCase = useOutletStore((s) => s.outlet?.use_case) ?? null;
  return useQuery({
    queryKey: [CATEGORIES_KEY, orgSlug, hasItems ? 'with-items' : 'all', useCase ?? 'all'],
    queryFn: () => categoriesApi.list(orgSlug, { hasItems, useCase }),
    enabled: !!orgSlug,
    placeholderData: [],
    staleTime: 120_000,
  });
}

export function useDeleteCategory(orgSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => categoriesApi.delete(orgSlug, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CATEGORIES_KEY, orgSlug] });
    },
  });
}
