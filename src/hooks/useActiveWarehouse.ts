'use client';

import { useWarehouses } from '@/hooks/useWarehouses';
import { useOutletStore } from '@/store/outlet';
import { useOutletFilterStore } from '@/store/outlet-filter';
import { useAuthStore } from '@/store/auth';
import { canAccessAllOutlets } from '@/lib/auth/outlet-access';
import { type Warehouse } from '@/lib/api/warehouses';
import { useEffect, useMemo, useState } from 'react';

/**
 * useActiveWarehouse — shared branch (warehouse) resolver for WRITE forms (Purchase Order
 * create, Goods Receipt, Stock Adjustment, Transfer). Confirmed UX:
 *
 *  - Default the active warehouse to the currently selected OUTLET FILTER.
 *  - If the outlet filter is unset AND the user has no fixed home outlet either (HQ-capable
 *    users who have explicitly chosen "All Outlets" — OutletFilter's applyAll() clears both
 *    stores together), the resolution is a best-effort guess only — `mustPick` is true and the
 *    caller MUST require an explicit warehouse pick before submit (block with an inline prompt
 *    if unresolved). Scoped staff/managers never touch the drill-down filter at all (it's
 *    hidden for them) but always have a home outlet fixed at login, so for them the home-outlet
 *    resolution IS authoritative and `mustPick` must be false — don't demand a redundant pick.
 *  - Reads stay filter-scoped; only writes use this hook.
 *
 * A warehouse "belongs" to an outlet via Warehouse.outlet_id. The default warehouse for an
 * outlet is the one flagged is_default (falling back to the first one for that outlet).
 *
 * Returns the resolved warehouseId + a setter (so the form can override), the candidate warehouse
 * list (full tenant-wide set for an HQ-capable admin's top-nav drill-down, but still locked to
 * one outlet for scoped/non-admin staff — see `options`'s own doc below for why), and
 * `mustPick`/`unresolved` flags for inline gating.
 */
export interface UseActiveWarehouseResult {
  /** Currently effective warehouse id ('' when none chosen yet). */
  warehouseId: string;
  /** Explicit override setter (user picked a warehouse). */
  setWarehouseId: (id: string) => void;
  /** Reset to the outlet default (clears the user-pick flag) — for form open/reset cycles. */
  reset: () => void;
  /** Warehouses to offer in the picker. Widens to the FULL tenant-wide set for any user who
   *  holds cross-outlet access (canAccessAllOutlets — platform owner/superuser/admin-level role),
   *  so having a specific outlet "in view" up top never stops them picking a different outlet's
   *  warehouse where the operation legitimately needs one (stock transfer's source most
   *  concretely). Stays locked to just the active outlet for a genuinely scoped/non-admin staff
   *  member instead — removing that lock would let them pick a warehouse outside their own
   *  assignment. See the `scopedOptions` implementation below for the exact rule. `warehouseId`
   *  still pre-selects the active outlet's warehouse either way — this only affects what's
   *  offered in the dropdown. */
  options: Warehouse[];
  /** All warehouses (unscoped), for reference. */
  allWarehouses: Warehouse[];
  /** True when no outlet filter is set AND the user must explicitly confirm the warehouse. */
  mustPick: boolean;
  /** True when a pick is required but nothing is selected yet → block submit + show prompt. */
  unresolved: boolean;
  /** The outlet name the warehouse was scoped to (for UI copy), if any. */
  scopedOutletName?: string;
  isLoading: boolean;
}

function defaultWarehouseForOutlet(warehouses: Warehouse[], outletId?: string | null): Warehouse | undefined {
  if (!outletId) return undefined;
  const scoped = warehouses.filter((w) => w.outlet_id === outletId && w.is_active !== false);
  return scoped.find((w) => w.is_default) ?? scoped[0];
}

export function useActiveWarehouse(orgSlug: string): UseActiveWarehouseResult {
  const { data: warehouses, isLoading } = useWarehouses(orgSlug);
  const allWarehouses = useMemo(() => warehouses ?? [], [warehouses]);

  // The drill-down outlet filter (null = "All Outlets") and the user's home outlet.
  const filterOutlet = useOutletFilterStore((s) => s.selectedOutlet);
  const homeOutlet = useOutletStore((s) => s.outlet);

  // The outlet that scopes this write: the filter selection wins; else the home outlet.
  const activeOutletId = filterOutlet?.id ?? homeOutlet?.id ?? null;
  const activeOutletName = filterOutlet?.name ?? homeOutlet?.name;

  // A pick is only required when NEITHER source resolves an outlet — i.e. an HQ-capable user
  // has explicitly selected "All Outlets" (OutletFilter.applyAll() clears filterOutlet AND
  // homeOutlet together). Scoped staff/managers never have a filter selection (the drill-down
  // is hidden for them), but their homeOutlet is always fixed at login, so `!filterOutlet` alone
  // must NOT force a pick for them — that was the bug: it treated every scoped-staff session as
  // ambiguous "All Outlets", showing a false "choose the warehouse" warning on a form whose
  // outlet was never actually in question.
  const mustPick = !filterOutlet && !homeOutlet;

  // Scope the picker options to ONE outlet only for a genuinely scoped/non-admin staff member —
  // letting the raw tenant-wide list through for them would let them pick a warehouse outside
  // their own outlet assignment, which is the access-control gap this scoping originally closed
  // (see stock-take/page.tsx's CreateCountDialog, which reuses this same options list for exactly
  // that reason).
  //
  // The gate is the SAME permission check the top-nav OutletFilter itself uses to decide whether
  // to show the drill-down at all (canAccessAllOutlets — platform owner / superuser / admin-level
  // role), NOT merely "is the drill-down filter currently populated". Keying off `filterOutlet`
  // alone was tried first and was wrong: OutletFilter's own default-branch-preselect effect only
  // calls `selectOutlet` (which sets `filterOutlet`) when NEITHER store already has a value, so
  // an admin/manager whose `homeOutlet` got set some other way first (PIN login, the
  // select-outlet gate, SSO callback) would reach this hook with `filterOutlet` still empty even
  // though they hold full cross-outlet access — leaving them just as locked out as the scoped
  // staff this rule exists to restrict. Checking the permission directly instead of inferring it
  // from incidental store timing fixes that for every admin/manager, not just the ones who
  // happened to click the drill-down first.
  const user = useAuthStore((s) => s.user);
  const canSeeAllOutlets = canAccessAllOutlets(user);
  const scopedOptions = useMemo(() => {
    if (canSeeAllOutlets) return allWarehouses;
    if (!activeOutletId) return allWarehouses;
    const scoped = allWarehouses.filter((w) => w.outlet_id === activeOutletId);
    return scoped.length > 0 ? scoped : allWarehouses;
  }, [allWarehouses, activeOutletId, canSeeAllOutlets]);

  const [warehouseId, setWarehouseIdState] = useState('');
  const [touched, setTouched] = useState(false);

  // Seed/refresh the default once warehouses load and the active outlet changes, but never
  // clobber an explicit user pick.
  useEffect(() => {
    if (touched) return;
    if (allWarehouses.length === 0) return;
    const def =
      defaultWarehouseForOutlet(allWarehouses, activeOutletId) ??
      allWarehouses.find((w) => w.is_default) ??
      undefined;
    setWarehouseIdState(def?.id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allWarehouses, activeOutletId]);

  const setWarehouseId = (id: string) => {
    setTouched(true);
    setWarehouseIdState(id);
  };

  // Reset to the outlet default and re-arm auto-seeding (used on form open/close cycles).
  const reset = () => {
    setTouched(false);
    const def =
      defaultWarehouseForOutlet(allWarehouses, activeOutletId) ??
      allWarehouses.find((w) => w.is_default) ??
      undefined;
    setWarehouseIdState(def?.id ?? '');
  };

  // Unresolved = a pick is required (All Outlets) but the warehouse isn't a confirmed,
  // outlet-scoped default — i.e. the user hasn't explicitly chosen and we can't trust the seed.
  const unresolved = mustPick && (!warehouseId || !touched);

  return {
    warehouseId,
    setWarehouseId,
    reset,
    options: scopedOptions,
    allWarehouses,
    mustPick,
    unresolved,
    scopedOutletName: activeOutletName,
    isLoading,
  };
}
