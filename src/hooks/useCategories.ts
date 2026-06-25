'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '@/lib/api/categories';

const CATEGORIES_KEY = 'categories';

export function useCategories(orgSlug: string, opts?: { hasItems?: boolean }) {
  const hasItems = opts?.hasItems ?? false;
  return useQuery({
    queryKey: [CATEGORIES_KEY, orgSlug, hasItems ? 'with-items' : 'all'],
    queryFn: () => categoriesApi.list(orgSlug, { hasItems }),
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
