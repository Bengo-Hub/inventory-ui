'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  rfqApi,
  type AwardEntry,
  type CreateRFQInput,
  type QuoteInput,
  type RFQStatus,
} from '@/lib/api/rfq';

const RFQ_KEY = 'rfqs';

export function useRFQs(orgSlug: string, status?: RFQStatus) {
  return useQuery({
    queryKey: [RFQ_KEY, orgSlug, status ?? 'all'],
    queryFn: () => rfqApi.list(orgSlug, status),
    enabled: !!orgSlug,
    staleTime: 20_000,
  });
}

export function useRFQ(orgSlug: string, id: string) {
  return useQuery({
    queryKey: [RFQ_KEY, orgSlug, id],
    queryFn: () => rfqApi.get(orgSlug, id),
    enabled: !!orgSlug && !!id,
  });
}

export function useRFQComparison(orgSlug: string, id: string, enabled: boolean) {
  return useQuery({
    queryKey: [RFQ_KEY, orgSlug, id, 'comparison'],
    queryFn: () => rfqApi.comparison(orgSlug, id),
    enabled: !!orgSlug && !!id && enabled,
    staleTime: 10_000,
  });
}

/** Builds a mutation hook that invalidates the RFQ list + a single RFQ + its comparison.
 * Both the argument and return types are inferred from `fn`, so call sites get a fully
 * typed `mutate(args)` and a typed `onSuccess(data)`. */
function useRFQMutation<TArgs, TData>(orgSlug: string, fn: (args: TArgs) => Promise<TData>, id?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RFQ_KEY, orgSlug] });
      if (id) qc.invalidateQueries({ queryKey: [RFQ_KEY, orgSlug, id] });
    },
  });
}

export function useCreateRFQ(orgSlug: string) {
  return useRFQMutation(orgSlug, (data: CreateRFQInput) => rfqApi.create(orgSlug, data));
}

export function useUpdateRFQ(orgSlug: string, id: string) {
  return useRFQMutation(orgSlug, (data: CreateRFQInput) => rfqApi.update(orgSlug, id, data), id);
}

export function useDeleteRFQ(orgSlug: string) {
  return useRFQMutation(orgSlug, (rfqId: string) => rfqApi.remove(orgSlug, rfqId));
}

export function useInviteRFQSuppliers(orgSlug: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (supplierIds: string[]) => rfqApi.invite(orgSlug, id, supplierIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RFQ_KEY, orgSlug] });
      qc.invalidateQueries({ queryKey: [RFQ_KEY, orgSlug, id] });
    },
  });
}

export function useRemoveRFQSupplier(orgSlug: string, id: string) {
  return useRFQMutation(orgSlug, (responseId: string) => rfqApi.removeSupplier(orgSlug, id, responseId), id);
}

export function useSendRFQ(orgSlug: string, id: string) {
  return useRFQMutation(orgSlug, (_args: void) => rfqApi.send(orgSlug, id), id);
}

export function useCaptureRFQQuote(orgSlug: string, id: string) {
  return useRFQMutation(
    orgSlug,
    ({ responseId, data }: { responseId: string; data: QuoteInput }) => rfqApi.quote(orgSlug, id, responseId, data),
    id,
  );
}

export function useDeclineRFQResponse(orgSlug: string, id: string) {
  return useRFQMutation(orgSlug, (responseId: string) => rfqApi.decline(orgSlug, id, responseId), id);
}

export function useAwardRFQ(orgSlug: string, id: string) {
  return useRFQMutation(orgSlug, (awards: AwardEntry[]) => rfqApi.award(orgSlug, id, awards), id);
}

export function useConvertRFQToPOs(orgSlug: string, id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (warehouseId?: string) => rfqApi.convertToPOs(orgSlug, id, warehouseId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RFQ_KEY, orgSlug] });
      qc.invalidateQueries({ queryKey: [RFQ_KEY, orgSlug, id] });
      qc.invalidateQueries({ queryKey: ['purchase-orders', orgSlug] });
    },
  });
}
