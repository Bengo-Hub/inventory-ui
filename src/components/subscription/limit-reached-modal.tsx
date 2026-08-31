'use client';

import { LimitReachedModal as SharedLimitReachedModal } from '@bengo-hub/shared-ui-lib/subscription';

import { useLimitModal } from '@/store/limit-modal';
import { useSubscription } from '@/hooks/use-subscription';

const SUBSCRIBE_URL =
  process.env.NEXT_PUBLIC_SUBSCRIPTIONS_UI_URL || 'https://pricing.codevertexafrica.com';

/**
 * Global limit-reached modal for inventory. Opened imperatively (via useLimitModal) when a
 * mutation returns 402. Inventory plan limits are structural (warehouses, SKUs, suppliers) —
 * not overage-eligible — so the shared modal always renders its plain "Upgrade plan" CTA
 * (no onEnableOverage passed). Exempt users never see it.
 */
export function LimitReachedModal() {
  const { open, info, close } = useLimitModal();
  const { isPlatformOwner, isDemo, isServiceCharge } = useSubscription();

  if (isPlatformOwner || isDemo || isServiceCharge) return null;

  return (
    <SharedLimitReachedModal open={open} info={info} onClose={close} subscribeUrl={SUBSCRIBE_URL} />
  );
}
