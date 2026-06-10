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
