import { apiClient } from './client';

export interface DocumentSequence {
  doc_type: string;
  prefix: string;
  separator: string;
  date_format: string; // '', YYMMDD, YYYYMMDD, MMYY, YYYY
  padding: number;
  reset_freq: string; // never | daily | monthly | yearly
  current_val: number;
  next_number: string;
}

export type UpdateDocumentSequenceInput = Pick<
  DocumentSequence,
  'prefix' | 'separator' | 'date_format' | 'padding' | 'reset_freq'
>;

export const DOC_TYPE_LABELS: Record<string, string> = {
  purchase_order: 'Purchase Order',
  grn: 'Goods Receipt (GRN)',
  purchase_return: 'Purchase Return',
  event_ticket: 'Event Ticket',
};

export const DATE_FORMATS: { value: string; label: string }[] = [
  { value: '', label: 'No date' },
  { value: 'YYMMDD', label: 'YYMMDD (260625)' },
  { value: 'YYYYMMDD', label: 'YYYYMMDD (20260625)' },
  { value: 'MMYY', label: 'MMYY (0626)' },
  { value: 'YYYY', label: 'YYYY (2026)' },
];

export const documentSequencesApi = {
  list: (orgSlug: string) =>
    apiClient.get<{ data: DocumentSequence[] }>(`/api/v1/${orgSlug}/inventory/document-sequences`),
  update: (orgSlug: string, docType: string, data: UpdateDocumentSequenceInput) =>
    apiClient.put<DocumentSequence>(`/api/v1/${orgSlug}/inventory/document-sequences/${docType}`, data),
  preview: (orgSlug: string, docType: string) =>
    apiClient.get<{ next_number: string }>(`/api/v1/${orgSlug}/inventory/document-sequences/${docType}/preview`),
};
