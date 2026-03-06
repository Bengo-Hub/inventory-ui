/**
 * Branding API (notifications-api). Logo and theme colors per tenant.
 * Notifications-api: GET /api/v1/{tenantId}/branding (authenticated).
 */

const NOTIFICATIONS_URL =
  process.env.NEXT_PUBLIC_NOTIFICATIONS_URL || 'https://notifications.codevertexitsolutions.com';

export interface TenantBranding {
  tenant_id: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  font_family?: string;
}

const defaults: TenantBranding = {
  tenant_id: '',
  logo_url: '/logo.png',
  primary_color: '#0ea5e9',
  secondary_color: '#6366f1',
};

export async function getBranding(
  tenantId: string,
  accessToken: string | null
): Promise<TenantBranding> {
  if (!tenantId) return defaults;
  if (!accessToken) return defaults;
  try {
    const res = await fetch(`${NOTIFICATIONS_URL}/api/v1/${encodeURIComponent(tenantId)}/branding`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!res.ok) return defaults;
    const data = (await res.json()) as TenantBranding;
    return {
      ...defaults,
      ...data,
    };
  } catch {
    return defaults;
  }
}
