'use client';

import { useAuthStore } from '@/store/auth';
import { useOutletFilterStore, type OutletOption } from '@/store/outlet-filter';
import { useOutletStore, INVENTORY_SELECTED_OUTLET_KEY } from '@/store/outlet';
import { canAccessAllOutlets } from '@/lib/auth/outlet-access';
import { useAllOutlets } from '@/hooks/useAllOutlets';
import { apiClient } from '@/lib/api/client';
import { Check, ChevronDown, Store, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * OutletFilter — branch/outlet selector for inventory-ui.
 *
 * HQ-only (platform owner, superuser, tenant admin). Hidden for scoped staff/managers,
 * whose outlet access is fixed at login via the select-outlet gate (and enforced server-side
 * by /my-outlets). Selecting here drives the whole app — it updates the shared outlet store,
 * so the sidebar modules + page nomenclature re-render for the chosen outlet's use_case, and
 * syncs the X-Outlet-ID header on every API request. "All Outlets" restores the HQ superset.
 */
export function OutletFilter({ className }: { className?: string }) {
  const user = useAuthStore((s) => s.user);
  const canFilter = canAccessAllOutlets(user);

  const { selectedOutlet, outlets, setOutlets, selectOutlet, clearOutlet } = useOutletFilterStore();
  const setHomeOutlet = useOutletStore((s) => s.setOutlet);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  // Apply a drill-down selection to the whole app: the filter store (dropdown highlight),
  // the shared outlet store (drives sidebar gating + nomenclature + X-Outlet-ID header).
  function applyOutlet(o: OutletOption) {
    selectOutlet(o);
    setHomeOutlet({ id: o.id, code: o.code, name: o.name, use_case: o.useCase, is_hq: o.isHq });
    setOpen(false);
    setSearch('');
  }

  // "All Outlets" — clear the drill-down and show the full HQ superset. The localStorage
  // marker is set to 'all' so the outlet-selection gate treats this as an explicit choice.
  function applyAll() {
    clearOutlet();
    setHomeOutlet(null);
    try { localStorage.setItem(INVENTORY_SELECTED_OUTLET_KEY, 'all'); } catch { /* ignore */ }
    setOpen(false);
    setSearch('');
  }

  const { data: fetched = [] } = useAllOutlets(canFilter);

  useEffect(() => {
    if (fetched.length > 0) {
      setOutlets(
        fetched.map((o) => ({ id: o.id, code: o.code, name: o.name, useCase: o.use_case, isHq: o.is_hq })),
      );
    }
  }, [fetched, setOutlets]);

  // BUG FIX (live-reported): this effect used to set the header to `selectedOutlet?.id ?? null`
  // — but selectedOutlet (this component's own local drill-down state) is NOT persisted, so it
  // always starts null on every fresh mount (every login redirect, every hard reload). That
  // unconditionally clobbered the outlet header to null/unscoped, and the preselect effect below
  // — meant to repair it — bails out immediately whenever homeOutlet is already set (the common
  // case: PIN login, a returning session, an SSO single-outlet user), so it never re-fired and
  // the header stayed wrong for the rest of the session even though the UI (reading
  // useOutletStore.outlet directly) showed the correct outlet name. Fixed by resolving the
  // EFFECTIVE outlet — the drill-down override if one is active, else the home/login outlet —
  // instead of trusting this component's own possibly-still-empty local state. Mirrors the
  // fallback pos-ui's equivalent store already uses correctly (store/auth.ts
  // setSelectedOutletId there falls back to the home outlet the same way).
  //
  // The query-cache invalidation that must follow any outlet change lives centrally in
  // OrgShell (watching useOutletStore.outlet, which applyOutlet/applyAll below always update
  // too) rather than here, since this component is only one of several flows (PIN login, SSO
  // callback, the select-outlet gate) that change the effective outlet — see org-shell.tsx.
  const homeOutlet = useOutletStore((s) => s.outlet);
  useEffect(() => {
    apiClient.setOutletID(selectedOutlet?.id ?? homeOutlet?.id ?? null);
  }, [selectedOutlet, homeOutlet]);

  // Default branch preselect: an admin/manager with NO outlet of their own starts scoped to
  // the tenant's default branch (the HQ outlet, else the first) instead of the unscoped
  // "All Outlets" superset. An explicit "All Outlets" choice (localStorage marker 'all') and
  // a remembered last-used outlet are both honoured first.
  useEffect(() => {
    if (selectedOutlet || homeOutlet || outlets.length === 0) return;
    let marker: string | null = null;
    try { marker = localStorage.getItem(INVENTORY_SELECTED_OUTLET_KEY); } catch { /* ignore */ }
    if (marker === 'all') return; // the user explicitly chose the HQ superset
    const preferred =
      (marker ? outlets.find((o) => o.id === marker) : undefined) ??
      outlets.find((o) => o.isHq) ??
      outlets[0];
    if (preferred) {
      selectOutlet(preferred);
      setHomeOutlet({ id: preferred.id, code: preferred.code, name: preferred.name, use_case: preferred.useCase, is_hq: preferred.isHq });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlets, selectedOutlet, homeOutlet]);

  if (!canFilter || outlets.length === 0) return null;

  const filtered = search
    ? outlets.filter(
        (o) =>
          o.name.toLowerCase().includes(search.toLowerCase()) ||
          o.code.toLowerCase().includes(search.toLowerCase()),
      )
    : outlets;

  const label = selectedOutlet ? selectedOutlet.name : 'All Outlets';

  return (
    <div className={cn('relative', className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors min-w-0 max-w-37.5 sm:max-w-none sm:min-w-40"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Store className="size-4 text-muted-foreground shrink-0" />
        <span className="truncate flex-1 text-left">{label}</span>
        {selectedOutlet && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); applyAll(); }}
            className="p-0.5 rounded hover:bg-muted-foreground/20"
            aria-label="Clear outlet filter"
          >
            <X className="size-3" />
          </button>
        )}
        <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => { setOpen(false); setSearch(''); }} aria-hidden />
          <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border border-border bg-popover shadow-xl flex flex-col">
            {outlets.length > 5 && (
              <div className="p-2 border-b border-border">
                <input
                  autoFocus
                  placeholder="Search outlets…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-accent/30 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}

            <button
              type="button"
              onClick={applyAll}
              className={cn(
                'flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm font-medium hover:bg-muted transition-colors',
                !selectedOutlet && 'bg-primary/10 text-primary',
              )}
            >
              {!selectedOutlet ? <Check className="size-3.5 shrink-0" /> : <span className="size-3.5 shrink-0" />}
              All Outlets
            </button>

            <div className="max-h-56 overflow-y-auto">
              {filtered.map((o) => {
                const selected = selectedOutlet?.id === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => applyOutlet(o)}
                    className={cn(
                      'flex items-center gap-2 w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors',
                      selected && 'bg-primary/5',
                    )}
                  >
                    <span className={cn(
                      'size-3.5 shrink-0 rounded-full border flex items-center justify-center',
                      selected ? 'bg-primary border-primary' : 'border-border',
                    )}>
                      {selected && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-medium">{o.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {o.code}{o.useCase ? ` · ${o.useCase}` : ''}{o.isHq ? ' · HQ' : ''}
                      </span>
                    </span>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="px-3 py-4 text-xs text-muted-foreground text-center">No outlets found</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
