import { apiClient } from './client';

export type ApprovalModule =
  | 'purchase_order'
  | 'requisition'
  | 'stock_transfer'
  | 'stock_adjustment'
  | 'stock_writeoff'
  | 'stock_count'
  | 'purchase_return'
  | 'goods_receipt'
  | 'production_batch'
  | 'asset_disposal'
  | 'asset_transfer'
  | 'asset_maintenance'
  | 'rfq'
  | 'contract';

/** All modules the approval engine understands, matching the backend ApprovalRule enum. */
export const APPROVAL_MODULES: { value: ApprovalModule; label: string; group: string }[] = [
  { value: 'purchase_order',   label: 'Purchase Order (send)',        group: 'Procurement' },
  { value: 'requisition',      label: 'Requisition (submit)',         group: 'Procurement' },
  { value: 'rfq',              label: 'RFQ (award)',                  group: 'Procurement' },
  { value: 'purchase_return',  label: 'Purchase Return (approve)',    group: 'Procurement' },
  { value: 'goods_receipt',    label: 'Goods Receipt (post)',         group: 'Procurement' },
  { value: 'contract',         label: 'Contract (activate)',          group: 'Procurement' },
  { value: 'production_batch', label: 'Production Batch (start)',      group: 'Manufacturing' },
  { value: 'stock_transfer',   label: 'Stock Transfer (ship)',        group: 'Stock' },
  { value: 'stock_adjustment', label: 'Stock Adjustment (post)',      group: 'Stock' },
  { value: 'stock_writeoff',   label: 'Stock Write-off (damage/loss)', group: 'Stock' },
  { value: 'stock_count',      label: 'Stock Count / Take (approve)', group: 'Stock' },
  { value: 'asset_disposal',   label: 'Asset Disposal (complete)',    group: 'Assets' },
  { value: 'asset_transfer',   label: 'Asset Transfer (complete)',    group: 'Assets' },
  { value: 'asset_maintenance', label: 'Asset Maintenance (complete)', group: 'Assets' },
];

/** Human labels for every module, for tables and badges. */
export const APPROVAL_MODULE_LABELS: Record<ApprovalModule, string> = {
  purchase_order:   'Purchase Order',
  requisition:      'Requisition',
  rfq:              'RFQ Award',
  purchase_return:  'Purchase Return',
  goods_receipt:    'Goods Receipt',
  contract:         'Contract',
  production_batch: 'Production Batch',
  stock_transfer:   'Stock Transfer',
  stock_adjustment: 'Stock Adjustment',
  stock_writeoff:   'Stock Write-off',
  stock_count:      'Stock Count / Take',
  asset_disposal:   'Asset Disposal',
  asset_transfer:   'Asset Transfer',
  asset_maintenance: 'Asset Maintenance',
};
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

/**
 * Shape of the 422 body the API returns when a stock adjustment / write-off falls in
 * an ApprovalRule band and must be signed off before it can post.
 */
export interface ApprovalGateResponse {
  approval_required: boolean;
  intent_id?: string;
  request_id?: string;
  module?: ApprovalModule;
  state?: string;
}

/** Reads an approval-gate body off a thrown axios error, or null if it isn't one. */
export function approvalGateFromError(err: unknown): ApprovalGateResponse | null {
  const data = (err as { response?: { data?: ApprovalGateResponse } })?.response?.data;
  return data && data.approval_required ? data : null;
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
