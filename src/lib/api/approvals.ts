import { apiClient } from './client';

export type ApprovalModule =
  | 'purchase_order'
  | 'requisition'
  | 'stock_transfer'
  | 'purchase_return'
  | 'goods_receipt'
  | 'production_batch'
  | 'asset_disposal'
  | 'asset_transfer'
  | 'asset_maintenance'
  | 'rfq'
  | 'contract';
export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type ApprovalActionStatus = 'pending' | 'approved' | 'rejected' | 'skipped';

export interface ApprovalStep {
  id?: string;
  sequence: number;
  name: string;
  approver_role: string;
}

export interface ApprovalRule {
  id: string;
  module: ApprovalModule;
  name: string;
  min_amount: number;
  max_amount: number | null;
  is_active: boolean;
  steps: ApprovalStep[];
}

export interface ApprovalRuleInput {
  module: ApprovalModule;
  name: string;
  min_amount: number;
  max_amount?: number | null;
  is_active?: boolean;
  steps: ApprovalStep[];
}

export interface ApprovalAction {
  id: string;
  sequence: number;
  name: string;
  approver_role: string;
  status: ApprovalActionStatus;
  acted_by?: string;
  acted_at?: string;
  comment?: string;
}

export interface ApprovalRequest {
  id: string;
  module: ApprovalModule;
  object_id: string;
  object_reference: string;
  amount: number;
  status: ApprovalRequestStatus;
  current_sequence: number;
  current_step?: ApprovalAction;
  actions?: ApprovalAction[];
  created_at: string;
  decided_at?: string;
}

export interface ApprovalRequestListParams {
  status?: ApprovalRequestStatus;
  module?: ApprovalModule;
  object_id?: string;
  inbox?: boolean;
}

export interface SubmitForApprovalResult {
  approval_required: boolean;
  request?: ApprovalRequest;
  message?: string;
}

const base = (orgSlug: string) => `/api/v1/${orgSlug}/inventory`;

export const approvalsApi = {
  // Rules
  listRules: (orgSlug: string, module?: ApprovalModule) =>
    apiClient.get<ApprovalRule[]>(`${base(orgSlug)}/approval-rules`, module ? { module } : undefined),
  getRule: (orgSlug: string, id: string) =>
    apiClient.get<ApprovalRule>(`${base(orgSlug)}/approval-rules/${id}`),
  createRule: (orgSlug: string, data: ApprovalRuleInput) =>
    apiClient.post<ApprovalRule>(`${base(orgSlug)}/approval-rules`, data),
  updateRule: (orgSlug: string, id: string, data: ApprovalRuleInput) =>
    apiClient.put<ApprovalRule>(`${base(orgSlug)}/approval-rules/${id}`, data),
  deleteRule: (orgSlug: string, id: string) =>
    apiClient.delete<{ deleted: boolean; id: string }>(`${base(orgSlug)}/approval-rules/${id}`),

  // Requests
  listRequests: (orgSlug: string, params?: ApprovalRequestListParams) =>
    apiClient.get<ApprovalRequest[]>(`${base(orgSlug)}/approval-requests`, params),
  getRequest: (orgSlug: string, id: string) =>
    apiClient.get<ApprovalRequest>(`${base(orgSlug)}/approval-requests/${id}`),
  approve: (orgSlug: string, id: string, comment?: string) =>
    apiClient.post<ApprovalRequest>(`${base(orgSlug)}/approval-requests/${id}/approve`, { comment }),
  reject: (orgSlug: string, id: string, comment?: string) =>
    apiClient.post<ApprovalRequest>(`${base(orgSlug)}/approval-requests/${id}/reject`, { comment }),

  // Submit a purchase order for approval (creates a request if a rule matches)
  submitPurchaseOrder: (orgSlug: string, poId: string) =>
    apiClient.post<SubmitForApprovalResult>(`${base(orgSlug)}/purchase-orders/${poId}/submit-for-approval`, {}),
};
