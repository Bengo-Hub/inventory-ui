import type { UserProfile } from '@/store/auth';

/** Roles that may access every outlet (drill-down "All Outlets", cross-outlet exports, ...). */
const ADMIN_LEVEL_ROLES = ['admin', 'superuser', 'inventory_admin', 'super_admin'];

/**
 * canAccessAllOutlets — single source of truth for "may this user see/select every outlet",
 * shared by the header's OutletFilter drill-down and the export dialogs' outlet/warehouse
 * pickers (previously each had its own inline check, letting them silently drift — the export
 * dialogs had none at all). Mirrors pos-ui's `lib/auth/outlet-access.ts` of the same name —
 * same concept, same shape, kept consistent across both apps.
 */
export function canAccessAllOutlets(user: UserProfile | null | undefined): boolean {
  return !!(
    user?.isPlatformOwner ||
    user?.isSuperUser ||
    user?.roles?.some((r) => ADMIN_LEVEL_ROLES.includes(r))
  );
}
