'use client';

import { useEffect, useRef, useState } from 'react';

/** localStorage key for the per-device idle-screensaver timeout (minutes). */
export const IDLE_TIMEOUT_KEY = 'inventory-idle-timeout-minutes';

/** Default idle timeout in minutes when no local setting / service_config is present. */
export const DEFAULT_IDLE_MINUTES = 5;

/** Read the configured idle timeout (minutes) from the local device setting, clamped 1–120. */
export function readIdleMinutes(): number {
  if (typeof window === 'undefined') return DEFAULT_IDLE_MINUTES;
  try {
    const raw = window.localStorage.getItem(IDLE_TIMEOUT_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_IDLE_MINUTES;
    return Math.min(120, Math.max(1, n));
  } catch {
    return DEFAULT_IDLE_MINUTES;
  }
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
