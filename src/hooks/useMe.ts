'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

/** Auth-api GET /me response: user profile with roles and permissions (source of truth for RBAC). */
export interface MeResponse {
  id: string;
  email?: string;
  fullName?: string;
  organizationId?: string;
  roles: string[];
  permissions: string[];
  [key: string]: unknown;
}

const ME_QUERY_KEY = ['auth', 'me'] as const;
const ME_STALE_MS = 5 * 60 * 1000; // 5 min TTL

async function fetchMe(): Promise<MeResponse> {
  const data = await apiClient.get<MeResponse>('auth/me');
  return {
    ...data,
    roles: Array.isArray((data as any).roles) ? (data as any).roles : [],
    permissions: Array.isArray((data as any).permissions) ? (data as any).permissions : [],
  };
}

/** Load current user and RBAC (roles/permissions) from auth-api GET /me with TanStack Query and TTL. */
export function useMe(enabled = true) {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: fetchMe,
    enabled,
    staleTime: ME_STALE_MS,
    gcTime: ME_STALE_MS * 2,
    retry: (failureCount, error: any) => {
      if (error?.response?.status === 401 || error?.response?.status === 403) return false;
      return failureCount < 2;
    },
  });
}

export function useHasRole(role: string): boolean {
  const { data } = useMe();
  return data?.roles?.includes(role) ?? false;
}

export function useHasPermission(permission: string): boolean {
  const { data } = useMe();
  return data?.permissions?.includes(permission) ?? false;
}

export function useIsSuperAdmin(): boolean {
  return useHasRole('super_admin');
}
