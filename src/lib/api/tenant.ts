/**
 * Tenant API (auth-api). Used for tenant-by-slug lookup.
 * Auth-api: GET /api/v1/tenants/by-slug/{slug} (public).
 */

const AUTH_API_URL =
  process.env.NEXT_PUBLIC_AUTH_API_URL ||
  process.env.NEXT_PUBLIC_SSO_URL ||
  'https://sso.codevertexitsolutions.com';

export interface TenantBySlug {
  id: string;
  name: string;
  slug: string;
  status?: string;
}

export async function getTenantBySlug(slug: string): Promise<TenantBySlug | null> {
  if (!slug) return null;
  try {
    const res = await fetch(`${AUTH_API_URL}/api/v1/tenants/by-slug/${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as TenantBySlug;
  } catch {
    return null;
  }
}
