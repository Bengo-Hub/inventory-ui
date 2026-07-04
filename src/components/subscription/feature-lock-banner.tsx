"use client";

import { Lock, Zap } from "lucide-react";
import Link from "next/link";

import { useSubscription } from "@/hooks/use-subscription";

const SUBSCRIBE_URL =
  process.env.NEXT_PUBLIC_SUBSCRIPTIONS_UI_URL || "https://pricing.codevertexitsolutions.com";

/**
 * FeatureLockBanner — a non-destructive, top-of-page upgrade blocker shown ONLY when the
 * tenant's plan lacks `feature`. It renders nothing when the feature is available (or while
 * loading), so a page can drop it in without hiding any of its own content or buttons. This
 * is how a gated page surfaces the upgrade prompt while keeping its nav item and actions
 * visible — subscription gating never hides UI, it just explains what's locked.
 */
export function FeatureLockBanner({ feature }: { feature: string }) {
  const { isActive, hasFeature, isLoading } = useSubscription();

  // Optimistic: never block while loading or when the feature is available.
  if (isLoading) return null;
  if (isActive && hasFeature(feature)) return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-500">
          <Lock className="size-4" />
        </span>
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-foreground">This feature needs a plan upgrade</p>
          <p className="text-xs text-muted-foreground">
            You can view this page, but actions here require a plan that includes it.
          </p>
        </div>
      </div>
      <Link
        href={`${SUBSCRIBE_URL}/subscribe`}
        className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
      >
        <Zap className="size-3.5" />
        Upgrade plan
      </Link>
    </div>
  );
}
