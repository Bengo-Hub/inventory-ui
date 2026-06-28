'use client';

import { useWarehouses } from '@/hooks/useWarehouses';
import { useOutletStore } from '@/store/outlet';
import { useOutletFilterStore } from '@/store/outlet-filter';
import { type Warehouse } from '@/lib/api/warehouses';
import { useEffect, useMemo, useState } from 'react';

/**
 * useActiveWarehouse — shared branch (warehouse) resolver for WRITE forms (Purchase Order
 * create, Goods Receipt, Stock Adjustment, Transfer). Confirmed UX:
 *
 *  - Default the active warehouse to the currently selected OUTLET FILTER.
 *  - If "All Outlets" is selected, fall back to the user's HOME/default outlet, but the
 *    resolution is NOT authoritative — `mustPick` is true and the caller MUST require an
 *    explicit warehouse pick before submit (block with an inline prompt if unresolved).
 *  - Reads stay filter-scoped; only writes use this hook.
 *
 * A warehouse "belongs" to an outlet via Warehouse.outlet_id. The default warehouse for an
 * outlet is the one flagged is_default (falling back to the first one for that outlet).
 *
 * Returns the resolved warehouseId + a setter (so the form can override), the candidate
 * warehouses scoped to the active outlet, and `mustPick`/`unresolved` flags for inline gating.
 */
export interface UseActiveWarehouseResult {
  /** Currently effective warehouse id ('' when none chosen yet). */
  warehouseId: string;
  /** Explicit override setter (user picked a warehouse). */
  setWarehouseId: (id: string) => void;
  /** Reset to the outlet default (clears the user-pick flag) — for form open/reset cycles. */
  reset: () => void;
  /** Warehouses to offer in the picker — scoped to the active outlet when one is resolvable,
   *  otherwise all warehouses (so an All-Outlets user can still choose any). */
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

  // When "All Outlets" is selected (no filter), the resolution is a best-effort fallback to the
  // home outlet and the user MUST explicitly confirm the warehouse before submitting.
  const mustPick = !filterOutlet;

  // Scope the picker options to the active outlet's warehouses when we can; otherwise show all.
  const scopedOptions = useMemo(() => {
    if (!activeOutletId) return allWarehouses;
    const scoped = allWarehouses.filter((w) => w.outlet_id === activeOutletId);
    return scoped.length > 0 ? scoped : allWarehouses;
  }, [allWarehouses, activeOutletId]);

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
