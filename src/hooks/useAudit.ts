'use client';

import { useQuery } from '@tanstack/react-query';
import { auditApi, type AuditLogFilters } from '@/lib/api/audit';

export function useAuditLogs(orgSlug: string, filters: AuditLogFilters = {}) {
  return useQuery({
    queryKey: ['inventory-audit-logs', orgSlug, filters],
    queryFn: () => auditApi.list(orgSlug, filters),
    enabled: !!orgSlug,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });
}
