"use client";

import {
  FeatureLockBanner as SharedFeatureLockBanner,
  useFeatureUpgrade,
} from "@bengo-hub/shared-ui-lib/subscription";

/**
 * FeatureLockBanner — thin delegate to the shared banner. Renders nothing when the feature
 * is available (or while loading); otherwise shows the non-hiding, top-of-page upgrade
 * prompt deep-linked to the pricing tier that unlocks `feature`.
 */
export function FeatureLockBanner({ feature }: { feature: string }) {
  const { upgradeHref } = useFeatureUpgrade(feature);
  return <SharedFeatureLockBanner feature={feature} upgradeUrl={upgradeHref} />;
}
