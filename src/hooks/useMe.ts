'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchInventoryProfile } from '@/lib/auth/api';
import { useAuthStore } from '@/store/auth';
import { useParams } from 'next/navigation';

/** Inventory service profile with local RBAC roles and permissions. */
export interface MeResponse {
  id: string;
  email?: string;
  fullName?: string;
  tenant_id?: string;
  tenant_slug?: string;
  roles: string[];
  permissions: string[];
  isPlatformOwner?: boolean;
  isSuperUser?: boolean;
  [key: string]: unknown;
}

const ME_STALE_MS = 5 * 60 * 1000; // 5 min TTL

/**
 * Load current user profile and RBAC from inventory-api GET /{tenant}/auth/me.
 * This gives service-level roles and permissions (not just SSO claims).
 */
export function useMe(enabled = true) {
  const accessToken = useAuthStore((s) => s.session?.accessToken);
  const storedUser = useAuthStore((s) => s.user);
  const params = useParams();

  // Resolve tenant slug: URL param > stored user > localStorage
  const orgSlug = (params?.orgSlug as string | undefined)
    ?? storedUser?.tenant_slug
    ?? (typeof window !== 'undefined' ? localStorage.getItem('tenantSlug') ?? '' : '');

  const query = useQuery({
    queryKey: ['auth', 'me', orgSlug],
    queryFn: async (): Promise<MeResponse> => {
      const data = await fetchInventoryProfile(orgSlug);
      return {
        ...data,
        roles: Array.isArray(data.roles) ? data.roles : [],
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
      };
    },
    enabled: enabled && !!accessToken && !!orgSlug,
    staleTime: ME_STALE_MS,
    gcTime: ME_STALE_MS * 2,
    retry: (failureCount, error: unknown) => {
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
  });

  const user = query.data ?? null;
  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];

  const hasRole = (role: string) => {
    if (!roles.length) return false;
    return roles.includes(role) || roles.includes('superuser') || roles.includes('inventory_admin');
  };

  const hasPermission = (permission: string) => {
    if (!user) return false;
    if (roles.includes('superuser') || roles.includes('inventory_admin')) return true;
    return permissions.includes(permission);
  };

  return {
    ...query,
    user,
    hasRole,
    hasPermission,
    isAuthenticated: !!user,
  };
}

export function useHasRole(role: string): boolean {
  const { hasRole } = useMe();
  return hasRole(role);
}

export function useHasPermission(permission: string): boolean {
  const { hasPermission } = useMe();
  return hasPermission(permission);
}

export function useIsSuperAdmin(): boolean {
  return useHasRole('inventory_admin');
}
