/**
 * Subscription information fetched lazily after login.
 * Used for UI-level feature gating (banners, lock icons, upgrade modals).
 * Login is NEVER blocked by subscription state — backend enforces on mutations.
 */

export interface SubscriptionInfo {
  status: string;
  planCode: string;
  planName: string;
  features: string[];
  limits: Record<string, number>;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
}

/**
 * Fetches subscription info via the local /api/subscription proxy route.
 * The proxy uses INTERNAL_SERVICE_KEY (server-side only) to call pricing-api S2S
 * so the browser never sends the service key directly.
 */
export async function fetchSubscriptionInfo(
  tenantId: string,
  _tenantSlug: string,
  _accessToken: string,
): Promise<SubscriptionInfo | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const resp = await fetch(`/api/subscription?tenantId=${encodeURIComponent(tenantId)}`, {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!resp.ok) return null;

    const data = await resp.json();
    if (!data) return null;

    const sub = data?.subscription ?? data;

    return {
      status: (sub.status ?? "none").toLowerCase(),
      planCode: sub.plan_code ?? sub.planCode ?? "",
      planName: sub.plan_name ?? sub.planName ?? "",
      features: sub.features ?? [],
      limits: sub.limits ?? {},
      trialEndsAt: sub.trial_ends_at ?? sub.trialEndsAt,
      currentPeriodEnd: sub.current_period_end ?? sub.currentPeriodEnd,
    };
  } catch {
    return null;
  }
}
