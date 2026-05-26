'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '@/lib/api/categories';

const CATEGORIES_KEY = 'categories';

export function useCategories(orgSlug: string) {
  return useQuery({
    queryKey: [CATEGORIES_KEY, orgSlug],
    queryFn: () => categoriesApi.list(orgSlug),
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
