import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * The canonical `step` for every decimal (money / quantity / rate / factor) input
 * in the app: allows entry down to 4 decimal places and no finer. Pair it with
 * {@link roundDecimal} at submit time so whatever the user types is stored at 4dp.
 */
export const DECIMAL_STEP = '0.0001';

/** Number of decimal places we keep for all money/quantity/rate values. */
export const DECIMAL_PLACES = 4;

/**
 * Round a number to at most 4 decimal places for storage/accuracy. Non-finite
 * input (NaN/Infinity) collapses to 0. The `+ Number.EPSILON` nudge avoids
 * float artefacts like `1.0055 -> 1.0054999…` rounding down.
 */
export function roundDecimal(value: number, places: number = DECIMAL_PLACES): number {
    if (!Number.isFinite(value)) return 0;
    const factor = 10 ** places;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Parse a user-entered decimal (string from a number input, or a raw number) and
 * round it to 4dp. Blank / unparseable input returns `fallback` (default 0).
 * Use this at every form-submit site that sends a decimal to the API.
 */
export function parseDecimal(value: string | number | null | undefined, fallback = 0): number {
    if (value === '' || value === null || value === undefined) return fallback;
    const n = typeof value === 'number' ? value : parseFloat(value);
    return Number.isFinite(n) ? roundDecimal(n) : fallback;
}

/**
 * Local calendar day as YYYY-MM-DD for an `<input type="date">` value, offset by `days`.
 * `new Date().toISOString().slice(0, 10)` is the UTC day, which in Kenya (UTC+3) is still
 * YESTERDAY until 03:00, so forms defaulted to it quietly recorded the wrong date.
 */
export function localDateInput(days = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Formats a date-only value ("YYYY-MM-DD", or an ISO timestamp whose date part is the calendar
 * day) as that exact day in the viewer's locale, without timezone conversion moving it to the
 * previous or next day.
 */
export function formatCalendarDay(day?: string | null): string {
  if (!day) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!m) return new Date(day).toLocaleDateString();
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString();
}
