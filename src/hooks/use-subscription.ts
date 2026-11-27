"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import type { SubscriptionInfo } from "@/lib/auth/subscription";
import { fetchSubscriptionInfo } from "@/lib/auth/subscription";
import { useSubscriptionStore } from "@/store/subscription";

/**
 * Reads the sub_exempt claim straight out of the access token (no signature verification —
 * purely to read a claim the SSO token already carries). The /me-derived `user` object never
 * carries this field, so this is the only reliable source client-side. Returns false on any
 * malformed/missing token.
 */
function decodeSubExempt(token: string | null | undefined): boolean {
  if (!token) return false;
  try {
    const part = token.split('.')[1];
    if (!part) return false;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = JSON.parse(atob(padded)) as Record<string, unknown>;
    return json?.sub_exempt === true;
  } catch {
    return false;
  }
}

// useSubscription is called by many components at once (a catalog page mounts one per row), and
// every instance used to run its own fetch and its own re-arm timer and listeners. Each re-arm
// cleared the shared store, so every mounted instance fetched again: one browser on a long catalog
// page sent about one /api/subscription request a second (ingress logs, 27 November 2026). These
// module-level guards keep it to one request per lookup and one set of listeners per tab.
let inflight: { tenantId: string; promise: Promise<SubscriptionInfo | null> } | null = null;
let lookupRetries = 0;
let rearmUsers = 0;
let rearmTeardown: (() => void) | null = null;

/** Starts the lookup, or returns null when another instance already has it in flight. */
function startLookup(tenantId: string, slug: string, token: string): Promise<SubscriptionInfo | null> | null {
  if (inflight && inflight.tenantId === tenantId) return null;
  const promise = fetchSubscriptionInfo(tenantId, slug, token).finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  inflight = { tenantId, promise };
  return promise;
}

/** One 60 s timer plus focus and visibility listeners per tab, shared by every hook instance. */
function acquireRearm(): () => void {
  rearmUsers += 1;
  if (!rearmTeardown) {
    const rearm = () => useAuthStore.getState().setSubscriptionInfo(undefined as any);
    const interval = setInterval(rearm, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') rearm(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', rearm);
    rearmTeardown = () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', rearm);
    };
  }
  return () => {
    rearmUsers -= 1;
    if (rearmUsers <= 0 && rearmTeardown) {
      rearmTeardown();
      rearmTeardown = null;
      rearmUsers = 0;
    }
  };
}

export function useSubscription() {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const subscriptionInfo = useAuthStore((s) => s.subscriptionInfo);
  const setSubscriptionInfo = useAuthStore((s) => s.setSubscriptionInfo);

  const subStore = useSubscriptionStore();

  const tenantSlug = user?.tenant_slug as string | undefined;
  // Platform-owner detection: snake_case (is_platform_owner) AND camelCase (isPlatformOwner) AND
  // the codevertex slug. Deliberately does NOT include the superuser/admin role — a tenant
  // superuser is a tenant-level admin and must NOT bypass subscription gating (platform SEC-3
  // policy: otherwise any tenant admin unlocks paid features for free). `roles` still drives
  // real RBAC elsewhere, just not this.
  const isPlatformOwner =
    !!(user as any)?.is_platform_owner ||
    !!(user as any)?.isPlatformOwner;
  const isServiceCharge = (user as any)?.billing_mode === 'service_charge';
  const isDemo = !!(user as any)?.is_demo || tenantSlug === 'codevertex-demo';
  // Platform-granted per-tenant exemption (sub_exempt JWT claim) — decoded straight from the
  // access token since it's never round-tripped onto the /me-derived `user` object here. Without
  // this, marking a tenant subscription-exempt could never actually unblock a non-admin user of
  // that tenant in this app.
  const isSubExempt = decodeSubExempt(session?.accessToken);
  // Single exemption flag — exempt accounts bypass ALL feature/limit gating.
  const isExempt = isPlatformOwner || isDemo || isServiceCharge || isSubExempt;

  // Hydrate from IndexedDB on auth so gating works offline
  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    const slug = tenantSlug ?? '';
    if (slug) useSubscriptionStore.getState().loadFromIDB(slug);
  }, [status, user, tenantSlug]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken || !user) return;
    if (subscriptionInfo !== undefined) return;

    const tenantId = user.tenant_id;
    const slug = tenantSlug ?? '';

    if (!tenantId || isPlatformOwner) {
      setSubscriptionInfo(null);
      const platformInfo = {
        status: 'active', planCode: 'enterprise', planName: 'Enterprise', features: [], limits: {},
      };
      setSubscriptionInfo(platformInfo as any);
      useSubscriptionStore.getState().setFromRaw(
        { plan: 'ENTERPRISE', status: 'ACTIVE', features: [], limits: {} }, slug,
      );
      return;
    }

    // A FAILED lookup (network/5xx/timeout) is NOT the same as "no subscription".
    // fetchSubscriptionInfo returns null ONLY on failure — never collapse that to
    // status:'none', which would trigger the full-page "Subscription Required" lockout for
    // a genuinely-active tenant (e.g. while subscription-api is mid-redeploy). Instead FAIL
    // OPEN: keep the last-known-good cached entitlements (so active tenants stay in), else a
    // non-blocking 'unknown' status; and retry a few times so it self-heals when the API returns.
    const handleLookupFailure = () => {
      const cached = useSubscriptionStore.getState();
      if (cached.hydrated && cached.status) {
        setSubscriptionInfo({
          status: String(cached.status).toLowerCase(),
          planCode: (cached.plan as string) ?? '',
          planName: '',
          features: cached.features ?? [],
          limits: cached.limits ?? {},
        } as any);
      } else {
        // No cache yet: 'unknown' is deliberately NOT 'none', so needsSubscription stays false
        // and the tenant is never locked out on a transient lookup failure.
        setSubscriptionInfo({ status: 'unknown', planCode: '', planName: '', features: [], limits: {} } as any);
      }
      if (lookupRetries < 4) {
        lookupRetries += 1;
        // Re-arm (subscriptionInfo -> undefined) after a growing delay: 8, 16, 32 then 64 s.
        setTimeout(() => setSubscriptionInfo(undefined as any), 8000 * 2 ** (lookupRetries - 1));
      }
    };

    // Only the instance that starts the lookup handles its result; the others render from the
    // shared store when it lands.
    const lookup = startLookup(tenantId, slug, session.accessToken);
    if (!lookup) return;
    setSubscriptionInfo(null);
    lookup
      .then((info) => {
        if (info === null) {
          handleLookupFailure();
          return;
        }
        lookupRetries = 0;
        setSubscriptionInfo(info as any);
        useSubscriptionStore.getState().setFromRaw(
          {
            plan: info.planCode || null, status: info.status || null,
            expiresAt: (info as any).currentPeriodEnd ?? (info as any).trialEndsAt ?? null,
            features: info.features, limits: info.limits,
          },
          slug,
        );
      })
      .catch(() => handleLookupFailure());
  }, [status, session?.accessToken, user, subscriptionInfo, setSubscriptionInfo, tenantSlug, isPlatformOwner]);

  // Defense-in-depth freshness, independent of the real-time WS push (use-notification-stream's
  // "entitlements_changed" handler already re-arms this on a grant/revoke/plan change — this is
  // the fallback for when that socket is reconnecting or unavailable): re-check at most once a
  // minute, and whenever the tab regains focus/visibility — a tenant admin who revoked an add-on
  // in one tab and switches back to another tab showing it should see it correct within a beat,
  // not stay stale indefinitely. Matches the 60s window the /api/subscription proxy route already
  // uses for its own Next.js fetch-cache revalidation.
  const signedIn = status === 'authenticated' && !!session?.accessToken && !!user;
  useEffect(() => {
    if (!signedIn) return;
    return acquireRearm();
  }, [signedIn]);

  const info = subscriptionInfo as SubscriptionInfo | null | undefined;
  const subStatus = info?.status ?? null;

  return {
    info,
    status: subStatus,
    plan: info?.planCode ?? null,
    tierOrder: info?.tierOrder ?? null,
    isActive: subStatus === 'active' || subStatus === 'trial' || isExempt,
    isPastDue: subStatus === 'past_due' || subStatus === 'suspended',
    isExpired: subStatus === 'expired' || subStatus === 'cancelled',
    needsSubscription: subStatus === 'none' && !isExempt,
    isLoading: subscriptionInfo === null || subscriptionInfo === undefined,
    isPlatformOwner,
    isServiceCharge,
    isDemo,
    // Exempt accounts (platform owner / superuser / demo / service-charge) ALWAYS have
    // every feature — never blocked by subscription gating.
    hasFeature: (code: string) => isExempt || (info?.features?.includes(code) ?? false),
    getLimit: (key: string) => (isExempt ? Infinity : ((info?.limits?.[key] ?? Infinity) as number)),
    daysUntilExpiry: subStore.daysUntilExpiry,
    isInGracePeriod: subStore.isInGracePeriod,
    gracePeriodEndsAt: subStore.gracePeriodEndsAt,
    // Product codes the tenant has actually self-activated (distinct from `features`, which is
    // plan entitlement — a tenant can be entitled to a product and still have turned it off).
    // Exempt tenants (platform owner/demo/service-charge) see every app.
    activeProducts: isExempt ? undefined : (info?.activeProducts ?? []),
    // Service tags the plan covers; undefined (all services shown) when exempt or not loaded yet.
    activeServiceTags: isExempt ? undefined : info?.activeServiceTags,
    store: subStore,
  };
}
