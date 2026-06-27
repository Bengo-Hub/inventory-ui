'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';
import {
  SCREENSAVER_IDLE_KEY,
  serviceConfigApi,
  type ServiceConfigEntry,
} from '@/lib/api/service-config';
import { DEFAULT_IDLE_SECONDS, readIdleOverrideSeconds } from '@/hooks/use-idle';

/** Allowed range for the screensaver idle timeout (seconds). Mirrors the app default. */
export const MIN_IDLE_SECONDS = 5;
export const MAX_IDLE_SECONDS = 3600;

/** Clamp an arbitrary value to the valid idle-timeout range, falling back to the default. */
export function clampIdleSeconds(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_IDLE_SECONDS;
  return Math.min(MAX_IDLE_SECONDS, Math.max(MIN_IDLE_SECONDS, Math.round(value)));
}

function parseSeconds(raw: string | undefined, fallback: number): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  return clampIdleSeconds(Number.isFinite(n) ? n : fallback);
}

/**
 * Resolve the EFFECTIVE screensaver idle timeout in seconds. Single source of
 * truth for resolution precedence:
 *   1. device-local override (this device only, localStorage)
 *   2. service_config (tenant override → platform default), from /{tenant}/settings
 *   3. app default (300s = 5 min)
 */
export function resolveIdleSeconds(serviceValue?: string): number {
  const override = readIdleOverrideSeconds();
  if (override != null) return override;
  if (serviceValue) return parseSeconds(serviceValue, DEFAULT_IDLE_SECONDS);
  return DEFAULT_IDLE_SECONDS;
}

// ── Tenant settings (merged platform + tenant override) ─────────────────────

/** The merged service_config entry for the screensaver key (tenant scope). */
export function useScreensaverSetting(orgSlug: string | undefined) {
  return useQuery({
    queryKey: ['service-config', 'tenant', orgSlug, SCREENSAVER_IDLE_KEY],
    queryFn: async (): Promise<ServiceConfigEntry | null> => {
      const list = await serviceConfigApi.listTenant(orgSlug!);
      return list.find((e) => e.config_key === SCREENSAVER_IDLE_KEY) ?? null;
    },
    enabled: !!orgSlug,
    staleTime: 5 * 60 * 1000,
  });
}

/** Set the tenant-level override for the screensaver idle timeout (tenant admin). */
export function useUpdateTenantScreensaver(orgSlug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seconds: number) =>
      serviceConfigApi.upsertTenant(orgSlug, SCREENSAVER_IDLE_KEY, String(clampIdleSeconds(seconds))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-config', 'tenant', orgSlug, SCREENSAVER_IDLE_KEY] });
      toast.success('Tenant screensaver timeout saved');
    },
    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to save tenant default')),
  });
}

// ── Platform default (platform owner only) ──────────────────────────────────

/** The platform default service_config entry for the screensaver key. */
export function usePlatformScreensaverSetting(enabled: boolean) {
  return useQuery({
    queryKey: ['service-config', 'platform', SCREENSAVER_IDLE_KEY],
    queryFn: async (): Promise<ServiceConfigEntry | null> => {
      const list = await serviceConfigApi.listPlatform();
      return list.find((e) => e.config_key === SCREENSAVER_IDLE_KEY) ?? null;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/** Set the platform default for the screensaver idle timeout (platform owner). */
export function useUpdatePlatformScreensaver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (seconds: number) =>
      serviceConfigApi.upsertPlatform(SCREENSAVER_IDLE_KEY, String(clampIdleSeconds(seconds))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['service-config', 'platform', SCREENSAVER_IDLE_KEY] });
      toast.success('Platform screensaver default saved');
    },
    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to save platform default')),
  });
}
