'use client';

import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
import { useOutletStore, type OutletInfo, INVENTORY_SELECTED_OUTLET_KEY } from '@/store/outlet';
import { isInventoryApplicableUseCase } from '@/lib/use-case-nomenclature';
import { BrandedAuthShell } from '@/components/auth/branded-auth-shell';
import { AllOutletsCard, OutletCard } from '@/components/auth/outlet-card';
import { IdleScreensaver } from '@/components/idle-screensaver';
import { LogOut, Warehouse } from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

// HQ = can access all outlets. Driven by the server (the /my-outlets `is_hq` flag, which
// reflects the JWT is_hq_user / admin claim) — this role list is only a client-side fallback
// for when the server omits the flag. `manager`/`store_manager` are intentionally NOT here:
// a manager assigned to a single outlet is scoped to it, so per-use-case gating applies.
const HQ_ROLES = ['admin', 'inventory_admin', 'superuser', 'super_admin'];

function SelectOutletContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const orgSlug = params?.orgSlug as string;
  const returnTo = searchParams?.get('returnTo');

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { setOutlet } = useOutletStore();

  const [outlets, setOutlets] = useState<OutletInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecting, setSelecting] = useState<string | 'all' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isHQUser =
    user?.isPlatformOwner ||
    user?.isSuperUser ||
    (user?.roles ?? []).some((r) => HQ_ROLES.includes(r));

  const lastOutletId =
    typeof window !== 'undefined' ? localStorage.getItem(INVENTORY_SELECTED_OUTLET_KEY) : null;

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
          setOutlets(sortLastUsed(active));
          setLoading(false);
          return;
        }

        // Auto-select "All Outlets" if that was last choice
        if (lastOutletId === 'all') {
          handleSelectAll();
          return;
        }

        const sorted = sortLastUsed(active);
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

  function sortLastUsed(list: OutletInfo[]): OutletInfo[] {
    return [...list].sort((a, b) => {
      if (a.id === lastOutletId) return -1;
      if (b.id === lastOutletId) return 1;
      return 0;
    });
  }

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
    <>
      {/* Force re-auth for the next staff member when the device wakes from idle. */}
      <IdleScreensaver onWake={() => void logout()} />

      <BrandedAuthShell
        title={isHQUser ? 'Select View' : 'Select Your Outlet'}
        subtitle={
          isHQUser
            ? 'Choose a specific outlet or view data across all outlets'
            : "Choose the outlet warehouse you're working in"
        }
        footer={
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out / switch account
          </button>
        }
      >
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        {outlets.length === 0 && !error && (
          <div className="text-center py-10 text-muted-foreground">
            <Warehouse className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No outlets found. Contact your administrator.</p>
          </div>
        )}

        <div className="space-y-3">
          {isHQUser && outlets.length > 1 && (
            <AllOutletsCard
              selecting={selecting === 'all'}
              disabled={!!selecting}
              onSelect={handleSelectAll}
            />
          )}

          {outlets.map((outlet) => (
            <OutletCard
              key={outlet.id}
              outlet={outlet}
              lastUsed={outlet.id === lastOutletId}
              selecting={selecting === outlet.id}
              disabled={!!selecting}
              onSelect={() => handleSelect(outlet)}
            />
          ))}
        </div>

        {outlets.length > 0 && (
          <p className="text-center text-xs text-muted-foreground mt-6">
            {isHQUser
              ? 'You can switch outlets from the header at any time.'
              : 'You can switch outlets from the sidebar at any time.'}
          </p>
        )}
      </BrandedAuthShell>
    </>
  );
}

export default function SelectOutletPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SelectOutletContent />
    </Suspense>
  );
}
