'use client';

import { useEffect, useRef, useState } from 'react';

/** Legacy localStorage key for the per-device idle timeout (MINUTES). Read-only fallback. */
export const IDLE_TIMEOUT_KEY = 'inventory-idle-timeout-minutes';

/** localStorage key for the per-device idle-screensaver override (SECONDS). */
export const IDLE_OVERRIDE_SECONDS_KEY = 'inventory-idle-timeout-seconds';

/** App default idle timeout in seconds when no override / service_config is present (5 min). */
export const DEFAULT_IDLE_SECONDS = 300;

/** Default idle timeout in minutes (kept for backward compatibility). */
export const DEFAULT_IDLE_MINUTES = DEFAULT_IDLE_SECONDS / 60;

/**
 * Read the per-device idle-timeout OVERRIDE (seconds), or null if this device
 * has no local override set. Clamped to 5..3600. Prefers the seconds key, then
 * falls back to the legacy minutes key. Returning null lets callers fall back
 * to the service_config (tenant/platform) value.
 */
export function readIdleOverrideSeconds(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const rawSec = window.localStorage.getItem(IDLE_OVERRIDE_SECONDS_KEY);
    if (rawSec != null) {
      const n = parseInt(rawSec, 10);
      if (Number.isFinite(n) && n > 0) return Math.min(3600, Math.max(5, n));
    }
    const rawMin = window.localStorage.getItem(IDLE_TIMEOUT_KEY);
    if (rawMin != null) {
      const m = parseInt(rawMin, 10);
      if (Number.isFinite(m) && m > 0) return Math.min(3600, Math.max(5, m * 60));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Read the configured idle timeout (minutes) from the local device override,
 * falling back to the app default. Kept for backward compatibility with callers
 * that don't resolve the service_config value.
 */
export function readIdleMinutes(): number {
  const sec = readIdleOverrideSeconds();
  if (sec == null) return DEFAULT_IDLE_MINUTES;
  return Math.min(120, Math.max(1, Math.round(sec / 60)));
}

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;

/**
 * useIdle — reports whether the user has been idle for `timeoutMs`.
 *
 * Resets on any user interaction. `enabled=false` disables detection entirely
 * (and resets the idle state). Throttles mousemove/scroll resets so a busy
 * cursor doesn't thrash timers.
 */
export function useIdle(timeoutMs: number, enabled = true): { idle: boolean; wake: () => void } {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastReset = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setIdle(false);
      if (timer.current) clearTimeout(timer.current);
      return;
    }

    const arm = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setIdle(true), timeoutMs);
    };

    const onActivity = () => {
      const now = Date.now();
      // Throttle resets to at most once every 500ms (cheap for mousemove/scroll).
      if (now - lastReset.current < 500) return;
      lastReset.current = now;
      setIdle((wasIdle) => (wasIdle ? false : wasIdle));
      arm();
    };

    arm();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [timeoutMs, enabled]);

  return { idle, wake: () => setIdle(false) };
}
