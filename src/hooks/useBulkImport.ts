import { useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi, type BulkImportResult } from '@/lib/api/items';

export function useBulkImport(orgSlug: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation<BulkImportResult, Error, File>({
    mutationFn: (file: File) => itemsApi.bulkImport(orgSlug, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', orgSlug] });
      queryClient.invalidateQueries({ queryKey: ['recipes', orgSlug] });
      queryClient.invalidateQueries({ queryKey: ['modifiers', orgSlug] });
    },
  });

  return {
    bulkImport:  mutation.mutate,
    isPending:   mutation.isPending,
    result:      mutation.data ?? null,
    error:       mutation.error,
    reset:       mutation.reset,
    templateUrl: itemsApi.downloadTemplateUrl(orgSlug),
  };
}
