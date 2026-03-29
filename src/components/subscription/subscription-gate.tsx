"use client";

import { Lock, Zap } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { useSubscription } from "@/hooks/use-subscription";

const SUBSCRIBE_URL =
  process.env.NEXT_PUBLIC_SUBSCRIPTIONS_UI_URL || "https://pricing.codevertexitsolutions.com";

interface SubscriptionGateProps {
  /** Feature code required (e.g. "loyalty_program", "multi_outlet") */
  feature?: string;
  /** Minimum plan required (e.g. "growth", "professional") */
  plan?: string;
  /** Content to render when feature is available */
  children: ReactNode;
  /** Custom fallback when gated; defaults to upgrade prompt */
  fallback?: ReactNode;
}

/**
 * Wraps content that requires a specific subscription feature or plan.
 * Shows an upgrade prompt instead of the content when the feature is not available.
 * Never blocks rendering during loading — shows children optimistically.
 */
export function SubscriptionGate({
  feature,
  plan: _plan,
  children,
  fallback,
}: SubscriptionGateProps) {
  const { isActive, hasFeature, isLoading } = useSubscription();

  // While loading or if subscription is active with the required feature, show children
  if (isLoading || isActive) {
    if (feature && !isLoading && !hasFeature(feature)) {
      return <>{fallback ?? <DefaultUpgradePrompt feature={feature} />}</>;
    }
    return <>{children}</>;
  }

  // No active subscription — show upgrade prompt
  return <>{fallback ?? <DefaultUpgradePrompt feature={feature ?? null} />}</>;
}

function DefaultUpgradePrompt({ feature }: { feature: string | null }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 px-6 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Lock className="size-5 text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">
          {feature ? "Feature requires upgrade" : "Premium feature"}
        </p>
        <p className="text-xs text-muted-foreground">
          Upgrade your plan to access this feature and more.
        </p>
      </div>
      <Link
        href={`${SUBSCRIBE_URL}/subscribe`}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        <Zap className="size-3.5" />
        Upgrade plan
      </Link>
    </div>
  );
}
