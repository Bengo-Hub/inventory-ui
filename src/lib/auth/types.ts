export type UserRole = "staff" | "admin" | "superuser";

/**
 * Any inventory-api permission code (`inventory.{module}.{action}`). Kept as a template
 * literal rather than a hand-maintained union so the UI never drifts from the backend's
 * seeded permission catalog — the authoritative list lives in inventory-api
 * (cmd/seed/seed_permissions.go). Canonical modules include: items, variants, categories,
 * warehouses, stock, stock_count, recipes, consumptions, procurement, manufacturing,
 * assets, approvals, reservations, tickets, units, settings, config, users, audit.
 * The action verb is always one of view/add/change/delete/manage (+ *_own), never `read`.
 */
export type Permission = `inventory.${string}`;

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  roles: UserRole[];
  permissions: Permission[];
  organizationId: string;
  tenantId: string;
  tenantSlug: string;
  isPlatformOwner?: boolean;
  isSuperUser?: boolean;
}
