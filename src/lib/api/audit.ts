import { apiClient } from './client';

export interface AuditLogEntry {
  id: string;
  outlet_id?: string;
  actor_user_id: string;
  approver_user_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  reason?: string;
  before_json?: Record<string, unknown>;
  after_json?: Record<string, unknown>;
  amount?: number;
  created_at: string;
}

export interface AuditLogFilters {
  action?: string;
  actor?: string;
  outlet?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export const auditApi = {
  list: (orgSlug: string, filters: AuditLogFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.set(k, String(v));
    });
    const qs = params.toString();
    return apiClient.get<{ data: AuditLogEntry[]; total: number }>(
      `/api/v1/${orgSlug}/inventory/audit-logs${qs ? `?${qs}` : ''}`,
    );
  },
};
