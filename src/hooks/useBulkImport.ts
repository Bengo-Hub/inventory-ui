import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MutateOptions } from '@tanstack/react-query';
import { itemsApi, type BulkImportResult } from '@/lib/api/items';

export function useBulkImport(orgSlug: string) {
  const queryClient = useQueryClient();

  const mutation = useMutation<BulkImportResult, Error, { file: File; warehouseName?: string }>({
    mutationFn: ({ file, warehouseName }) => itemsApi.bulkImport(orgSlug, file, warehouseName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', orgSlug] });
      queryClient.invalidateQueries({ queryKey: ['recipes', orgSlug] });
      queryClient.invalidateQueries({ queryKey: ['modifiers', orgSlug] });
    },
  });

  return {
    bulkImport: (
      file: File,
      callbacks?: MutateOptions<BulkImportResult, Error, { file: File; warehouseName?: string }>,
      warehouseName?: string,
    ) => mutation.mutate({ file, warehouseName }, callbacks),
    isPending:   mutation.isPending,
    result:      mutation.data ?? null,
    error:       mutation.error,
    reset:       mutation.reset,
    templateUrl: itemsApi.downloadTemplateUrl(orgSlug),
    // Fetches the (auth-gated, multi-sheet XLSX) import template as a Blob and
    // triggers a browser download. Falls back to a client-generated CSV.
    downloadTemplate: () => itemsApi.downloadTemplate(orgSlug),
  };
}
