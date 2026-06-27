'use client';

import { Package } from 'lucide-react';
import { useMemo } from 'react';
import { useEffect, useState } from 'react';
import { useBranding } from '@/providers/branding-provider';
import { DEFAULT_IDLE_SECONDS, useIdle } from '@/hooks/use-idle';
import { resolveIdleSeconds } from '@/hooks/use-screensaver-timeout';

interface IdleScreensaverProps {
  /** Enable detection. Pass false on screens where a screensaver is unwanted. */
  enabled?: boolean;
  /**
   * Effective idle timeout in SECONDS. When omitted, falls back to the
   * device-local override → app default (the caller should pass the resolved
   * service_config value to honor tenant/platform defaults).
   */
  timeoutSeconds?: number;
  /**
   * Called once when the user wakes the screensaver. Use to force re-auth
   * (e.g. send the next staff member back to the PIN pad / login gate).
   */
  onWake?: () => void;
}

function useClock(active: boolean) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    if (!active) return;
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/**
 * IdleScreensaver — a branded, full-screen overlay shown after a configurable
 * idle timeout (default 5 min). The effective timeout resolves as service_config
 * (tenant/platform) → device-local override → default; callers pass the resolved
 * seconds via `timeoutSeconds`. Displays the tenant logo + a live clock. ANY interaction
 * dismisses it and returns to the underlying screen (and fires `onWake`, used
 * by the login gate to force re-auth for the next staff member).
 *
 * Reusable: drop it anywhere inside the branded tree. Uses only semantic /
 * tenant-branding tokens (no hardcoded colors).
 */
export function IdleScreensaver({ enabled = true, timeoutSeconds, onWake }: IdleScreensaverProps) {
  const { tenant } = useBranding();
  const seconds = timeoutSeconds ?? resolveIdleSeconds() ?? DEFAULT_IDLE_SECONDS;
  const timeoutMs = useMemo(() => Math.max(5, seconds) * 1000, [seconds]);
  const { idle, wake } = useIdle(timeoutMs, enabled);
  const now = useClock(idle);

  if (!idle) return null;

  const handleWake = () => {
    wake();
    onWake?.();
  };

  const timeLabel = now
    ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';
  const dateLabel = now
    ? now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Screensaver — tap to wake"
      onMouseDown={handleWake}
      onTouchStart={handleWake}
      onKeyDown={handleWake}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-10 bg-background animate-fade-up cursor-pointer select-none"
    >
      {/* Brand */}
      <div className="flex flex-col items-center gap-5">
        {tenant?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logoUrl}
            alt={tenant.name ?? 'Logo'}
            className="h-20 w-auto max-w-[260px] object-contain"
          />
        ) : (
          <div className="h-20 w-20 rounded-3xl bg-primary flex items-center justify-center shadow-2xl shadow-primary/30">
            <Package className="h-10 w-10 text-primary-foreground" />
          </div>
        )}
        <p className="text-lg font-bold tracking-tight text-foreground">
          {tenant?.orgName ?? tenant?.name ?? 'Inventory'}
        </p>
      </div>

      {/* Live clock */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-7xl sm:text-8xl font-black tabular-nums tracking-tight text-foreground">
          {timeLabel}
        </p>
        <p className="text-sm font-medium text-muted-foreground capitalize">{dateLabel}</p>
      </div>

      <p className="absolute bottom-10 text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground/60 animate-pulse">
        Touch anywhere to continue
      </p>
    </div>
  );
}
