'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approvalsApi,
  type ApprovalModule,
  type ApprovalRequestListParams,
  type ApprovalRuleInput,
} from '@/lib/api/approvals';

const RULES_KEY = 'approval-rules';
const REQS_KEY = 'approval-requests';

// ─── Rules ────────────────────────────────────────────────────────────────────

export function useApprovalRules(orgSlug: string, module?: ApprovalModule) {
  return useQuery({
    queryKey: [RULES_KEY, orgSlug, module ?? 'all'],
    queryFn: () => approvalsApi.listRules(orgSlug, module),
    enabled: !!orgSlug,
    staleTime: 30_000,
  });
}

export function useCreateApprovalRule(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ApprovalRuleInput) => approvalsApi.createRule(orgSlug, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [RULES_KEY, orgSlug] }),
  });
}

export function useUpdateApprovalRule(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ApprovalRuleInput }) =>
      approvalsApi.updateRule(orgSlug, id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: [RULES_KEY, orgSlug] }),
  });
}

export function useDeleteApprovalRule(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => approvalsApi.deleteRule(orgSlug, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: [RULES_KEY, orgSlug] }),
  });
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export function useApprovalRequests(orgSlug: string, params?: ApprovalRequestListParams) {
  return useQuery({
    queryKey: [REQS_KEY, orgSlug, params ?? {}],
    queryFn: () => approvalsApi.listRequests(orgSlug, params),
    enabled: !!orgSlug,
    staleTime: 15_000,
  });
}

/** Latest approval request for a specific document (PO / requisition), or undefined. */
export function useApprovalForObject(orgSlug: string, objectId: string | undefined) {
  return useQuery({
    queryKey: [REQS_KEY, orgSlug, 'object', objectId],
    queryFn: async () => {
      const rows = await approvalsApi.listRequests(orgSlug, { object_id: objectId });
      return rows[0]; // server returns most-recent first
    },
    enabled: !!orgSlug && !!objectId,
    staleTime: 10_000,
  });
}

function invalidateRequests(orgSlug: string, qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [REQS_KEY, orgSlug] });
}

export function useApproveRequest(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      approvalsApi.approve(orgSlug, id, comment),
    onSuccess: () => invalidateRequests(orgSlug, qc),
  });
}

export function useRejectRequest(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, comment }: { id: string; comment?: string }) =>
      approvalsApi.reject(orgSlug, id, comment),
    onSuccess: () => invalidateRequests(orgSlug, qc),
  });
}

export function useSubmitPurchaseOrderForApproval(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (poId: string) => approvalsApi.submitPurchaseOrder(orgSlug, poId),
    onSuccess: () => {
      invalidateRequests(orgSlug, qc);
      qc.invalidateQueries({ queryKey: ['purchase-orders', orgSlug] });
    },
  });
}
