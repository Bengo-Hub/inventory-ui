// Back-dating a stock adjustment. adjusted_at is the effective date the movement counts under and
// created_at the real entry time (inventory-api stock/adjustment_date.go). The server is the real
// enforcement point; these only give the date input immediate bounds.

import { localDateInput } from '@/lib/utils';

/** Furthest back an adjustment may be dated (mirrors inventory-api maxAdjustmentBackDays). */
export const ADJUSTMENT_BACKDATE_DAYS = 366;

/** The adjustment_date to send: nothing for a blank or today's date, which is a normal adjustment. */
export function adjustmentDateParam(value: string): string | undefined {
  return value && value !== localDateInput(0) ? value : undefined;
}

/**
 * True when an adjustment was entered at least 12 hours after the date it counts under. A
 * back-dated one is dated at the start of a day before today, so it is always at least 24 hours
 * earlier than its entry time, while every other adjustment stamps both together.
 */
export function isBackdatedAdjustment(a: { adjusted_at?: string; created_at: string }): boolean {
  if (!a.adjusted_at) return false;
  return new Date(a.created_at).getTime() - new Date(a.adjusted_at).getTime() > 12 * 60 * 60 * 1000;
}
