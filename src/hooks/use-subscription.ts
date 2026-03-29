"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/store/auth";
import type { SubscriptionInfo } from "@/lib/auth/subscription";
import { fetchSubscriptionInfo } from "@/lib/auth/subscription";

/**
 * Hook for accessing subscription state and feature gating.
 * Subscription is loaded lazily after authentication — never blocks login.
 *
 * Usage:
 *   const { isActive, hasFeature, isPastDue } = useSubscription();
 *   if (!hasFeature("loyalty_program")) showUpgradePrompt();
 */
export function useSubscription() {
  const session = useAuthStore((s) => s.session);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const subscriptionInfo = useAuthStore((s) => s.subscriptionInfo);
  const setSubscriptionInfo = useAuthStore((s) => s.setSubscriptionInfo);

  // Lazy-load subscription info after authentication
  useEffect(() => {
    if (status !== "authenticated" || !session?.accessToken || !user) return;
    if (subscriptionInfo !== undefined) return; // already loaded or loading

    // Mark as loading (null = loading, undefined = not started)
    setSubscriptionInfo(null);

    const tenantId = user.tenant_id;
    const tenantSlug = user.tenant_slug;

    if (!tenantId || tenantSlug === "codevertex") {
      // Platform owner — always full access
      setSubscriptionInfo({
        status: "active",
        planCode: "enterprise",
        planName: "Enterprise",
        features: [],
        limits: {},
      } as any);
      return;
    }

    fetchSubscriptionInfo(tenantId, tenantSlug ?? "", session.accessToken)
      .then((info) => setSubscriptionInfo((info ?? { status: "none", planCode: "", planName: "", features: [], limits: {} }) as any))
      .catch(() => setSubscriptionInfo({ status: "none", planCode: "", planName: "", features: [], limits: {} } as any));
  }, [status, session?.accessToken, user, subscriptionInfo, setSubscriptionInfo]);

  const info = subscriptionInfo as SubscriptionInfo | null | undefined;
  const subStatus = info?.status ?? null;

  return {
    /** Raw subscription info (null = loading, undefined = not started) */
    info,
    /** Subscription status string */
    status: subStatus,
    /** Plan code (e.g. "starter", "growth", "professional") */
    plan: info?.planCode ?? null,
    /** Whether subscription is active (active or trial) */
    isActive: subStatus === "active" || subStatus === "trial",
    /** Whether the subscription is in a warning state */
    isPastDue: subStatus === "past_due" || subStatus === "suspended",
    /** Whether the subscription has expired */
    isExpired: subStatus === "expired" || subStatus === "cancelled",
    /** Whether no subscription exists */
    needsSubscription: subStatus === "none",
    /** Whether subscription info is still loading */
    isLoading: subscriptionInfo === null || subscriptionInfo === undefined,
    /** Check if a specific feature is available */
    hasFeature: (code: string) => info?.features?.includes(code) ?? false,
    /** Get a usage limit value (defaults to Infinity if not set) */
    getLimit: (key: string) => info?.limits?.[key] ?? Infinity,
  };
}
