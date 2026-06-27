'use client';

import { Loader2, MonitorSmartphone, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import {
  DEFAULT_IDLE_SECONDS,
  IDLE_OVERRIDE_SECONDS_KEY,
  IDLE_TIMEOUT_KEY,
  readIdleOverrideSeconds,
} from '@/hooks/use-idle';
import {
  MAX_IDLE_SECONDS,
  MIN_IDLE_SECONDS,
  clampIdleSeconds,
  usePlatformScreensaverSetting,
  useScreensaverSetting,
  useUpdatePlatformScreensaver,
  useUpdateTenantScreensaver,
} from '@/hooks/use-screensaver-timeout';

const inputClass =
  'w-full bg-accent/10 border border-border rounded-lg py-2 px-3 text-sm focus:ring-1 focus:ring-primary outline-none disabled:opacity-50 disabled:cursor-not-allowed';
const labelClass = 'text-xs font-bold text-muted-foreground uppercase tracking-wider';

// ════════════════════════════════════════════════════════════════════════════
// Idle Screensaver card (General tab) — effective value + per-device override
// (+ optional tenant default for admins).
// ════════════════════════════════════════════════════════════════════════════

export function IdleScreensaverCard({ orgSlug, canEditTenant }: { orgSlug: string; canEditTenant: boolean }) {
  const { data: setting } = useScreensaverSetting(orgSlug);
  const updateTenant = useUpdateTenantScreensaver(orgSlug);

  // Service-config (tenant override → platform default) value in seconds.
  const serviceSeconds = setting?.config_value
    ? clampIdleSeconds(parseInt(setting.config_value, 10))
    : DEFAULT_IDLE_SECONDS;
  const isTenantOverride = setting?.is_override === true;

  // Per-device override (this device only); null = follow the service default.
  const [deviceOverride, setDeviceOverride] = useState<number | null>(null);
  const [tenantInput, setTenantInput] = useState<number>(DEFAULT_IDLE_SECONDS);

  useEffect(() => {
    setDeviceOverride(readIdleOverrideSeconds());
  }, []);
  useEffect(() => {
    setTenantInput(serviceSeconds);
  }, [serviceSeconds]);

  // Effective = device override → service default.
  const effectiveSeconds = deviceOverride ?? serviceSeconds;

  const saveDevice = (raw: number) => {
    const clamped = clampIdleSeconds(raw);
    setDeviceOverride(clamped);
    try {
      localStorage.setItem(IDLE_OVERRIDE_SECONDS_KEY, String(clamped));
      localStorage.removeItem(IDLE_TIMEOUT_KEY); // drop the legacy minutes key
      toast.success('Screensaver timeout saved for this device');
    } catch {
      toast.error('Could not save screensaver timeout');
    }
  };

  const clearDevice = () => {
    setDeviceOverride(null);
    try {
      localStorage.removeItem(IDLE_OVERRIDE_SECONDS_KEY);
      localStorage.removeItem(IDLE_TIMEOUT_KEY);
      toast.success('Using the tenant default on this device');
    } catch {
      /* ignore */
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MonitorSmartphone className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm">Idle Screensaver</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Effective + tenant default summary */}
        <div className="rounded-xl bg-accent/10 border border-border p-4 text-sm">
          <p className="font-bold">
            Effective on this device: <span className="font-mono">{effectiveSeconds}s</span>
            <span className="text-muted-foreground font-normal"> (~{Math.round(effectiveSeconds / 60)} min)</span>
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {isTenantOverride ? 'Tenant default' : 'Platform default'}: {serviceSeconds}s
            {deviceOverride != null && ' · overridden on this device below'}
          </p>
        </div>

        {/* Tenant default (admins only) */}
        {canEditTenant && (
          <div className="space-y-2 max-w-xs">
            <label className={labelClass}>Tenant default (seconds)</label>
            <div className="flex gap-2">
              <input
                type="number"
                min={MIN_IDLE_SECONDS}
                max={MAX_IDLE_SECONDS}
                value={tenantInput}
                onChange={(e) => setTenantInput(parseInt(e.target.value) || DEFAULT_IDLE_SECONDS)}
                className={`${inputClass} font-mono`}
              />
              <Button
                size="sm"
                onClick={() => updateTenant.mutate(tenantInput)}
                disabled={updateTenant.isPending}
                className="shrink-0"
              >
                {updateTenant.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Applies to all devices in this tenant (overrides the platform default).
            </p>
          </div>
        )}

        {/* Per-device override */}
        <div className="space-y-2 max-w-xs">
          <label className={labelClass}>Override on this device (seconds)</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={MIN_IDLE_SECONDS}
              max={MAX_IDLE_SECONDS}
              value={deviceOverride ?? ''}
              placeholder={String(serviceSeconds)}
              onChange={(e) => setDeviceOverride(parseInt(e.target.value) || null)}
              onBlur={(e) => {
                const v = parseInt(e.target.value);
                if (Number.isFinite(v) && v > 0) saveDevice(v);
              }}
              className={`${inputClass} font-mono`}
            />
            {deviceOverride != null && (
              <Button size="sm" variant="outline" onClick={clearDevice} className="shrink-0">
                Clear
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            This device only. After this much inactivity a branded full-screen clock appears; any
            interaction returns to the login / outlet picker (re-auth for the next user). Leave blank
            to follow the tenant default.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// Platform-default screensaver card (Platform tab) — platform owner only.
// ════════════════════════════════════════════════════════════════════════════

export function PlatformScreensaverCard() {
  const { data: setting, isLoading } = usePlatformScreensaverSetting(true);
  const update = useUpdatePlatformScreensaver();
  const [seconds, setSeconds] = useState<number>(DEFAULT_IDLE_SECONDS);

  useEffect(() => {
    if (setting?.config_value) setSeconds(clampIdleSeconds(parseInt(setting.config_value, 10)));
  }, [setting?.config_value]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" />
          <span className="font-bold text-sm">Screensaver Idle Timeout</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2 max-w-xs">
          <label className={labelClass}>Platform default (seconds)</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={MIN_IDLE_SECONDS}
              max={MAX_IDLE_SECONDS}
              value={seconds}
              disabled={isLoading}
              onChange={(e) => setSeconds(parseInt(e.target.value) || DEFAULT_IDLE_SECONDS)}
              className={`${inputClass} font-mono`}
            />
            <Button
              size="sm"
              onClick={() => update.mutate(seconds)}
              disabled={update.isPending || isLoading}
              className="shrink-0"
            >
              {update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Idle time before the screensaver shows; tenant default. Range {MIN_IDLE_SECONDS}–
            {MAX_IDLE_SECONDS}s. Tenants and individual devices can override this.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
