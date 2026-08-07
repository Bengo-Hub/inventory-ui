/**
 * Parses the structured 402 limit-reached body emitted by inventory-api (and the wider
 * platform) so the limit-reached modal can render a consistent message. Inventory plan
 * limits (warehouses, SKUs, suppliers) are structural — overageEligible is always false,
 * so the modal shows an "Upgrade plan" CTA.
 */

export interface LimitReachedInfo {
  metric: string;
  limit: number;
  used: number;
  overageEligible: boolean;
  overageUnitPrice: number;
  overageUnit: string;
  accruedOverageKes: number;
  upgradeUrl?: string;
}

export function parseLimitInfo(data: any): LimitReachedInfo | undefined {
  if (!data || data.metric === undefined || data.limit === undefined) return undefined;
  return {
    metric: String(data.metric),
    limit: Number(data.limit) || 0,
    used: Number(data.used) || 0,
    overageEligible: !!data.overage_eligible,
    overageUnitPrice: Number(data.overage_unit_price) || 0,
    overageUnit: String(data.overage_unit ?? ''),
    accruedOverageKes: Number(data.accrued_overage_kes) || 0,
    upgradeUrl: data.upgrade_url,
  };
}

/**
 * Non-metered subscription 403s (feature lock, inactive/expired subscription, plan-upgrade
 * required). Distinct from the 402 usage_limit_exceeded body above `parseLimitInfo` handles.
 */
export type SubscriptionErrorCode =
  | 'subscription_inactive'
  | 'subscription_expired'
  | 'feature_not_available'
  | 'device_limit_reached'
  | 'plan_upgrade_required';

const SUBSCRIPTION_CODES = new Set<SubscriptionErrorCode>([
  'subscription_inactive',
  'subscription_expired',
  'feature_not_available',
  'device_limit_reached',
  'plan_upgrade_required',
]);

/** Mirrors pos-ui's isSubscriptionError — matches the canonical WriteFeatureLocked body (code +
 *  upgrade:true) shared across every service's authclient-based feature gate. */
export function isSubscriptionError(data: any): boolean {
  if (!data) return false;
  if (data.upgrade === true) return true;
  return SUBSCRIPTION_CODES.has(data?.code as SubscriptionErrorCode);
}

const SUBSCRIPTION_MESSAGES: Record<SubscriptionErrorCode, string> = {
  subscription_inactive: 'Your subscription is inactive. Please renew to continue.',
  subscription_expired: 'Your subscription has expired. Renew now to restore access.',
  feature_not_available: 'This feature is not available on your current plan.',
  device_limit_reached: 'Device limit reached. Upgrade your plan to add more devices.',
  plan_upgrade_required: 'An upgrade is required to access this feature.',
};

export function subscriptionErrorMessage(data: any): string {
  const code = data?.code as SubscriptionErrorCode;
  if (code && SUBSCRIPTION_MESSAGES[code]) {
    return data.message || SUBSCRIPTION_MESSAGES[code];
  }
  return data?.message || SUBSCRIPTION_MESSAGES.subscription_inactive;
}
