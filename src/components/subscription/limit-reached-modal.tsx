'use client';

import { Button } from '@/components/ui/base';
import { useLimitModal } from '@/store/limit-modal';
import { useSubscription } from '@/hooks/use-subscription';

const SUBSCRIBE_URL =
  process.env.NEXT_PUBLIC_SUBSCRIPTIONS_UI_URL || 'https://pricing.codevertexitsolutions.com';

const prettyMetric = (m: string) => m.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Global limit-reached modal for inventory. Opened imperatively (via useLimitModal) when a
 * mutation returns 402. Inventory plan limits are structural (warehouses, SKUs, suppliers) —
 * not overage-eligible — so this routes to upgrade. Exempt users never see it.
 */
export function LimitReachedModal() {
  const { open, info, close } = useLimitModal();
  const { isPlatformOwner, isDemo, isServiceCharge } = useSubscription();

  if (!open || !info || isPlatformOwner || isDemo || isServiceCharge) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={close} />
      <div className="relative z-50 w-full max-w-sm mx-4 rounded-xl border border-border bg-card shadow-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold">{prettyMetric(info.metric)} limit reached</h2>
        <p className="text-sm text-muted-foreground">
          Your plan allows <span className="font-semibold">{info.limit.toLocaleString()}</span>{' '}
          {prettyMetric(info.metric).toLowerCase()}
          {info.used ? (
            <>
              {' '}and you&apos;ve used <span className="font-semibold">{info.used.toLocaleString()}</span>
            </>
          ) : null}
          . Upgrade your plan to raise this limit.
        </p>
        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={close}>
            Not now
          </Button>
          <a
            href={info.upgradeUrl || `${SUBSCRIBE_URL}/subscribe`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Upgrade plan
          </a>
        </div>
      </div>
    </div>
  );
}
