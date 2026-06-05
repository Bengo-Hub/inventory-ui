import type { Permission, UserProfile, UserRole } from "./types";

type Operator = "and" | "or";

/**
 * isPlatformOwner — single source of truth for "is this the SaaS platform operator".
 *
 * Platform-level pages are owner-only. A tenant `admin` / `inventory_admin` is NOT a
 * platform owner — only the `is_platform_owner` claim, the `superuser` role, or
 * membership in the codevertex tenant qualifies. Codevertex membership is verified via
 * the SERVER-returned tenant slug (`tenant_slug`/`tenantSlug`), never the URL `orgSlug`,
 * so navigating to `/codevertex/...` does not grant platform access to another tenant.
 *
 * Accepts both the auth-store user shape (`tenant_slug`) and the typed UserProfile.
 */
export function isPlatformOwner(
  user:
    | {
        isPlatformOwner?: boolean;
        isSuperUser?: boolean;
        roles?: string[];
        tenant_slug?: string;
        tenantSlug?: string;
      }
    | null
    | undefined,
): boolean {
  if (!user) return false;
  const slug = user.tenant_slug ?? user.tenantSlug ?? "";
  return (
    user.isPlatformOwner === true ||
    user.isSuperUser === true ||
    (user.roles?.includes("superuser") ?? false) ||
    slug === "codevertex"
  );
}

// Roles that grant full access to TENANT-level resources (settings, items, warehouses,
// stock, …). This mirrors the inventory-api RBAC middleware, which bypasses every per-route
// permission check for platform owners, superusers, and tenant admins (`claims.IsAdmin()` /
// the local `inventory_admin` role). Without this, a tenant admin — who has full API access —
// would be blocked client-side whenever a specific granular permission string is missing from
// their token (e.g. a newly added permission not yet in their cached claims). NOTE: this does
// NOT grant platform-level access; platform pages are gated separately via isPlatformOwner().
const FULL_TENANT_ACCESS_ROLES = ["superuser", "admin", "inventory_admin"];

function hasFullTenantAccess(user: UserProfile | null): boolean {
  if (!user) return false;
  if (user.isSuperUser === true || (user as { isPlatformOwner?: boolean }).isPlatformOwner === true) return true;
  const roles = (user.roles ?? []) as unknown as string[];
  return roles.some((r) => FULL_TENANT_ACCESS_ROLES.includes(r));
}

export function userHasRole(
  user: UserProfile | null,
  roles?: UserRole[] | null,
  operator: Operator = "or",
): boolean {
  if (!roles?.length) return true;
  if (!user) return false;
  // Superuser / platform owner / tenant admin bypass all role checks.
  if (hasFullTenantAccess(user)) return true;
  const matches = roles.map((role) => user.roles.includes(role));
  return operator === "and" ? matches.every(Boolean) : matches.some(Boolean);
}

export function userHasPermission(
  user: UserProfile | null,
  permissions?: Permission[] | null,
  operator: Operator = "or",
): boolean {
  if (!permissions?.length) return true;
  if (!user) return false;
  // Superuser / platform owner / tenant admin bypass all permission checks.
  if (hasFullTenantAccess(user)) return true;
  const matches = permissions.map((permission) => user.permissions.includes(permission));
  return operator === "and" ? matches.every(Boolean) : matches.some(Boolean);
}

export function userCanAccess(
  user: UserProfile | null,
  options: {
    roles?: UserRole[] | null;
    permissions?: Permission[] | null;
    roleOperator?: Operator;
    permissionOperator?: Operator;
  } = {},
): boolean {
  const { roles, permissions, roleOperator = "or", permissionOperator = "or" } = options;
  return (
    userHasRole(user, roles, roleOperator) &&
    userHasPermission(user, permissions, permissionOperator)
  );
}
