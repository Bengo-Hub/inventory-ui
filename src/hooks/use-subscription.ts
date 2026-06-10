"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";
import type { SubscriptionInfo } from "@/lib/auth/subscription";
import { fetchSubscriptionInfo } from "@/lib/auth/subscription";
import { useSubscriptionStore } from "@/store/subscription";

export function useSubscription() {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const subscriptionInfo = useAuthStore((s) => s.subscriptionInfo);
  const setSubscriptionInfo = useAuthStore((s) => s.setSubscriptionInfo);

  const subStore = useSubscriptionStore();

  const tenantSlug = user?.tenant_slug as string | undefined;
  const roles = (((user as any)?.roles ?? []) as string[]).map((r) => String(r).toLowerCase());
  const isSuperuser = roles.includes('superuser') || roles.includes('super_admin');
  // Robust platform-owner detection: snake_case (is_platform_owner) AND camelCase
  // (isPlatformOwner) AND the global superuser role AND the codevertex slug — any one of
  // these marks an account that must never be subscription-gated.
  const isPlatformOwner =
    !!(user as any)?.is_platform_owner ||
    !!(user as any)?.isPlatformOwner ||
    isSuperuser ||
    tenantSlug === 'codevertex';
  const isServiceCharge = (user as any)?.billing_mode === 'service_charge';
  const isDemo = !!(user as any)?.is_demo || tenantSlug === 'codevertex-demo';
  // Single exemption flag — exempt accounts bypass ALL feature/limit gating.
  const isExempt = isPlatformOwner || isDemo || isServiceCharge;

  // Hydrate from IndexedDB on auth so gating works offline
  useEffect(() => {
    if (status !== 'authenticated' || !user) return;
    const slug = tenantSlug ?? '';
    if (slug) useSubscriptionStore.getState().loadFromIDB(slug);
  }, [status, user, tenantSlug]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.accessToken || !user) return;
    if (subscriptionInfo !== undefined) return;

    setSubscriptionInfo(null);

    const tenantId = user.tenant_id;
    const slug = tenantSlug ?? '';

    if (!tenantId || isPlatformOwner) {
      const platformInfo = {
        status: 'active', planCode: 'enterprise', planName: 'Enterprise', features: [], limits: {},
      };
      setSubscriptionInfo(platformInfo as any);
      useSubscriptionStore.getState().setFromRaw(
        { plan: 'ENTERPRISE', status: 'ACTIVE', features: [], limits: {} }, slug,
      );
      return;
    }

    fetchSubscriptionInfo(tenantId, slug, session.accessToken)
      .then((info) => {
        const resolved = info ?? { status: 'none', planCode: '', planName: '', features: [], limits: {} };
        setSubscriptionInfo(resolved as any);
        useSubscriptionStore.getState().setFromRaw(
          {
            plan: resolved.planCode || null, status: resolved.status || null,
            expiresAt: (resolved as any).currentPeriodEnd ?? (resolved as any).trialEndsAt ?? null,
            features: resolved.features, limits: resolved.limits,
          },
          slug,
        );
      })
      .catch(() => setSubscriptionInfo({ status: 'none', planCode: '', planName: '', features: [], limits: {} } as any));
  }, [status, session?.accessToken, user, subscriptionInfo, setSubscriptionInfo, tenantSlug, isPlatformOwner]);

  const info = subscriptionInfo as SubscriptionInfo | null | undefined;
  const subStatus = info?.status ?? null;

  return {
    info,
    status: subStatus,
    plan: info?.planCode ?? null,
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
    store: subStore,
  };
}
