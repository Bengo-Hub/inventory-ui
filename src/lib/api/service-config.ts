import { apiClient } from './client';

/**
 * Generic service_config (platform default + tenant override) API.
 *
 * The inventory-api resolves platform defaults (tenant_id=nil) and tenant
 * overrides generically for ANY config key, so this single typed lib serves
 * every keyed setting. See inventory-api config_handler.go.
 */

/** A single resolved service_config entry as returned by the API. */
export interface ServiceConfigEntry {
  id: string;
  tenant_id?: string | null;
  config_key: string;
  config_value: string;
  config_type: string;
  description?: string;
  is_secret: boolean;
  /** True when this value is a tenant-level override of the platform default. */
  is_override: boolean;
  created_at: string;
  updated_at: string;
}

interface ListResponse {
  data: ServiceConfigEntry[];
  total: number;
}

/** Config key for the branded screensaver idle timeout (seconds). */
export const SCREENSAVER_IDLE_KEY = 'inventory.screensaver_idle_timeout_seconds';

export const serviceConfigApi = {
  /** Platform-level defaults (platform owner only). GET /api/v1/admin/config */
  listPlatform: () =>
    apiClient.get<ListResponse>('/api/v1/admin/config').then((r) => r.data ?? []),

  /** Upsert a platform default by key. PUT /api/v1/admin/config/{key} */
  upsertPlatform: (key: string, configValue: string, description?: string) =>
    apiClient.put<ServiceConfigEntry>(`/api/v1/admin/config/${key}`, {
      config_value: configValue,
      ...(description ? { description } : {}),
    }),

  /** Merged platform+tenant settings for the calling tenant. GET /api/v1/{tenant}/settings */
  listTenant: (orgSlug: string) =>
    apiClient.get<ListResponse>(`/api/v1/${orgSlug}/settings`).then((r) => r.data ?? []),

  /** Upsert a tenant override by key. PUT /api/v1/{tenant}/settings/{key} */
  upsertTenant: (orgSlug: string, key: string, configValue: string) =>
    apiClient.put<ServiceConfigEntry>(`/api/v1/${orgSlug}/settings/${key}`, {
      config_value: configValue,
    }),
};
