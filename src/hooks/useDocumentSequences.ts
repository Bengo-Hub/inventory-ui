'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { documentSequencesApi, type UpdateDocumentSequenceInput } from '@/lib/api/document-sequences';

const KEY = 'document-sequences';

export function useDocumentSequences(orgSlug: string) {
  return useQuery({
    queryKey: [KEY, orgSlug],
    queryFn: async () => (await documentSequencesApi.list(orgSlug)).data ?? [],
    enabled: !!orgSlug,
    staleTime: 60_000,
  });
}

export function useUpdateDocumentSequence(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docType, data }: { docType: string; data: UpdateDocumentSequenceInput }) =>
      documentSequencesApi.update(orgSlug, docType, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, orgSlug] }),
  });
}
