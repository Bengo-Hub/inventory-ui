'use client';

/**
 * usePermissions — single source of truth for action-button RBAC in inventory-ui.
 *
 * Permission resolution:
 *   1. superuser / platform-owner / admin roles always pass every check
 *   2. otherwise use the server-authoritative `permissions[]` carried on the
 *      profile (synced from inventory-api /auth/me into the auth store)
 *
 * Usage:
 *   const { can, canAny } = usePermissions();
 *   {can(P.CATALOG_ADD) && <Button>New Item</Button>}
 *   {canAny([P.SUPPLIERS_ADD, P.SUPPLIERS_MANAGE]) && <Button>Add Supplier</Button>}
 *
 * Mirrors pos-ui's hooks/usePermissions.ts API shape.
 */

import { useMemo } from 'react';
import { useAuthStore } from '@/store/auth';
import { P } from '@/lib/rbac/permissions';
import type { Permission } from '@/lib/auth/types';

// Roles that bypass every permission check. Matches the sidebar's ADMIN bypass
// and auth-api's seeded superuser/admin roles.
const SUPERUSER_ROLES = ['admin', 'superuser', 'super_admin', 'inventory_admin'];

export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  const isSuperuser = useMemo(() => {
    if (!user) return false;
    if (user.isPlatformOwner || user.isSuperUser) return true;
    return (user.roles ?? []).some((r) => SUPERUSER_ROLES.includes(r));
  }, [user]);

  const granted = useMemo<Set<string>>(
    () => new Set(user?.permissions ?? []),
    [user],
  );

  /** Check a single permission */
  function can(permission: Permission | string): boolean {
    if (isSuperuser) return true;
    return granted.has(permission);
  }

  /** True if the user has ANY of the given permissions */
  function canAny(permissions: (Permission | string)[]): boolean {
    if (isSuperuser) return true;
    return permissions.some((p) => granted.has(p));
  }

  /** True if the user has ALL of the given permissions */
  function canAll(permissions: (Permission | string)[]): boolean {
    if (isSuperuser) return true;
    return permissions.every((p) => granted.has(p));
  }

  return { can, canAny, canAll, isSuperuser, permissions: granted };
}

// Re-export P + Permission so consumers import everything from one place.
export { P } from '@/lib/rbac/permissions';
export type { Permission } from '@/lib/auth/types';
