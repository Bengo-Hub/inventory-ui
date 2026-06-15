'use client';

import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { useOutletStore, type OutletInfo, INVENTORY_SELECTED_OUTLET_KEY } from '@/store/outlet';
import { useBranding } from '@/providers/branding-provider';
import { isInventoryApplicableUseCase } from '@/lib/use-case-nomenclature';
import { Globe, Package, Warehouse, ChevronRight } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

// HQ = can access all outlets. Driven by the server (the /my-outlets `is_hq` flag, which
// reflects the JWT is_hq_user / admin claim) — this role list is only a client-side fallback
// for when the server omits the flag. `manager`/`store_manager` are intentionally NOT here:
// a manager assigned to a single outlet is scoped to it, so per-use-case gating applies.
const HQ_ROLES = ['admin', 'inventory_admin', 'superuser', 'super_admin'];

const USE_CASE_LABELS: Record<string, string> = {
  hospitality: 'Hospitality',
  quick_service: 'Quick Service',
  retail: 'Retail',
  pharmacy: 'Pharmacy',
  services: 'Services',
  cafe: 'Café',
  warehouse: 'Warehouse',
  logistics: 'Logistics',
};

const USE_CASE_COLORS: Record<string, string> = {
  hospitality: 'bg-amber-500/15 text-amber-400',
  quick_service: 'bg-orange-500/15 text-orange-400',
  retail: 'bg-blue-500/15 text-blue-400',
  pharmacy: 'bg-green-500/15 text-green-400',
  services: 'bg-purple-500/15 text-purple-400',
  cafe: 'bg-amber-500/15 text-amber-400',
  warehouse: 'bg-slate-500/15 text-slate-400',
  logistics: 'bg-cyan-500/15 text-cyan-400',
};

function SelectOutletContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const orgSlug = params?.orgSlug as string;
  const returnTo = searchParams?.get('returnTo');

  const user = useAuthStore((s) => s.user);
  const { setOutlet } = useOutletStore();
  const { tenant } = useBranding();

  const [outlets, setOutlets] = useState<OutletInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isHQUser =
    user?.isPlatformOwner ||
    user?.isSuperUser ||
    (user?.roles ?? []).some((r) => HQ_ROLES.includes(r));

  const lastOutletId = typeof window !== 'undefined'
    ? localStorage.getItem(INVENTORY_SELECTED_OUTLET_KEY) : null;

  const tenantRef = orgSlug; // always use slug — inventory-api routes use /{slug}/, not /{uuid}/

  const destination = returnTo ? decodeURIComponent(returnTo) : `/${orgSlug}`;

  useEffect(() => {
    if (!tenantRef) return;
    // my-outlets is assignment-filtered server-side: non-HQ users receive ONLY
    // the outlets they are assigned to; HQ/admins receive the full tenant list
    // (with is_hq=true). This is the login gate — a user can only enter an
    // outlet they are tied to.
    apiClient
      .get<{ data: OutletInfo[]; is_hq?: boolean }>(`/api/v1/${tenantRef}/inventory/my-outlets`)
      .then((resp) => {
        const data = Array.isArray(resp) ? (resp as unknown as OutletInfo[]) : (resp?.data ?? []);
        const serverIsHQ = Array.isArray(resp) ? isHQUser : !!resp?.is_hq;
        // Defense-in-depth: only show outlets whose use_case is relevant to inventory
        // (the server already filters, but never surface logistics/weighbridge/enforcement).
        const active = data
          .filter((o) => o.status !== 'inactive')
          .filter((o) => isInventoryApplicableUseCase(o.use_case));
        const hq = serverIsHQ || isHQUser;

        // Staff (non-HQ): may only enter an assigned outlet.
        if (!hq) {
          if (active.length === 0) {
            // No assignment → cannot enter any outlet; show contact-admin message.
            setOutlets([]);
            setLoading(false);
            return;
          }
          if (active.length === 1) {
            handleSelect(active[0]);
            return;
          }
          // Multiple assigned outlets — let them choose (sort last-used first).
          const sorted = [...active].sort((a, b) => {
            if (a.id === lastOutletId) return -1;
            if (b.id === lastOutletId) return 1;
            return 0;
          });
          setOutlets(sorted);
          setLoading(false);
          return;
        }

        // Auto-select "All Outlets" if that was last choice
        if (lastOutletId === 'all') {
          handleSelectAll();
          return;
        }

        // HQ: sort last-used to top
        const sorted = [...active].sort((a, b) => {
          if (a.id === lastOutletId) return -1;
          if (b.id === lastOutletId) return 1;
          return 0;
        });

        setOutlets(sorted);

        // Auto-select if only one outlet even for HQ
        if (sorted.length === 1) {
          handleSelect(sorted[0]);
          return;
        }

        // Auto-select last-used outlet for returning HQ users
        if (lastOutletId) {
          const lastOutlet = sorted.find((o) => o.id === lastOutletId);
          if (lastOutlet) {
            handleSelect(lastOutlet);
            return;
          }
        }

        // First login (no prior choice): preselect the outlet the HQ user is logged into —
        // their HQ outlet if present, otherwise the first applicable outlet — so they land
        // scoped to a real outlet (not the cross-outlet "All Outlets" aggregate). They can
        // switch outlets, or pick "All Outlets", from the header at any time.
        const home = sorted.find((o) => o.is_hq) ?? sorted[0];
        if (home) {
          handleSelect(home);
          return;
        }

        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load outlets. Please try again.');
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantRef]);

  function handleSelect(outlet: OutletInfo) {
    setSelecting(outlet.id);
    setOutlet(outlet);
    localStorage.setItem(INVENTORY_SELECTED_OUTLET_KEY, outlet.id);
    apiClient.setOutletID(outlet.id);
    router.replace(destination);
  }

  function handleSelectAll() {
    setSelecting('all');
    setOutlet(null);
    localStorage.setItem(INVENTORY_SELECTED_OUTLET_KEY, 'all');
    apiClient.setOutletID(null);
    router.replace(destination);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading outlets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          {tenant?.logoUrl ? (
            <img src={tenant.logoUrl} alt={tenant.name ?? orgSlug} className="h-12 w-auto object-contain" />
          ) : (
            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Package className="h-6 w-6 text-primary-foreground" />
            </div>
          )}
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-foreground mb-2">
            {isHQUser ? 'Select View' : 'Select Your Outlet'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isHQUser
              ? 'Choose a specific outlet or view data across all outlets'
              : 'Choose the outlet warehouse you\'re working in'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        {outlets.length === 0 && !error && (
          <div className="text-center py-12 text-muted-foreground">
            <Warehouse className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No outlets found. Contact your administrator.</p>
          </div>
        )}

        <div className="space-y-3">
          {/* All Outlets option — HQ users only */}
          {isHQUser && outlets.length > 1 && (
            <button
              type="button"
              onClick={handleSelectAll}
              disabled={!!selecting}
              className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 text-left group disabled:opacity-60"
            >
              <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
                {selecting === 'all' ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Globe className="h-5 w-5 text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-primary">All Outlets</p>
                <p className="text-xs text-muted-foreground mt-0.5">View data across all warehouses & outlets</p>
              </div>
              <ChevronRight className="h-4 w-4 text-primary/50 group-hover:text-primary transition-colors shrink-0" />
            </button>
          )}

          {outlets.map((outlet) => {
            const isLastUsed = outlet.id === lastOutletId;
            const isSelecting = selecting === outlet.id;
            const useCaseLabel = USE_CASE_LABELS[outlet.use_case ?? ''] ?? outlet.use_case;
            const useCaseColor = USE_CASE_COLORS[outlet.use_case ?? ''] ?? 'bg-slate-500/15 text-slate-400';

            return (
              <button
                key={outlet.id}
                type="button"
                onClick={() => handleSelect(outlet)}
                disabled={!!selecting}
                className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-accent transition-all duration-200 text-left group disabled:opacity-60"
              >
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Warehouse className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground truncate">{outlet.name}</p>
                    {isLastUsed && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                        Last used
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">{outlet.code}</span>
                    {useCaseLabel && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${useCaseColor}`}>
                        {useCaseLabel}
                      </span>
                    )}
                    {outlet.is_hq && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                        HQ
                      </span>
                    )}
                  </div>
                </div>
                {isSelecting ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {outlets.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-6">
            {isHQUser
              ? 'You can switch outlets from the header at any time.'
              : 'You can switch outlets from the sidebar at any time.'}
          </p>
        )}
      </div>
    </div>
  );
}

export default function SelectOutletPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SelectOutletContent />
    </Suspense>
  );
}
