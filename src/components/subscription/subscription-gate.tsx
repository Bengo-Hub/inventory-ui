"use client";

import type { ReactNode } from "react";
import { FeatureLock } from "@bengo-hub/shared-ui-lib/subscription";

interface SubscriptionGateProps {
  /** Feature code required (e.g. "loyalty_program", "multi_outlet") */
  feature?: string;
  /** Minimum plan required (e.g. "growth", "professional") */
  plan?: string;
  /** Content to render when feature is available */
  children: ReactNode;
  /** Custom fallback when gated; kept for signature compatibility — FeatureLock always shows an upgrade CTA instead */
  fallback?: ReactNode;
}

/**
 * SubscriptionGate — delegates to the shared <FeatureLock mode="block">.
 *
 * Show-but-lock: children are ALWAYS in the tree. When the tenant's plan lacks `feature`
 * (and the tenant isn't exempt), FeatureLock renders an upgrade CTA card whose interaction
 * opens the shared UpgradeDialog naming the unlocking tier + deep-linking to pricing —
 * never a dead-end hide. Exempt tenants and loading states pass straight through.
 */
export function SubscriptionGate({ feature, children }: SubscriptionGateProps) {
  if (!feature) return <>{children}</>;
  return (
    <FeatureLock feature={feature} mode="block">
      {children}
    </FeatureLock>
  );
}
