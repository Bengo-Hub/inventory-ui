import { apiClient } from '@/lib/api/client';

/**
 * Fetch user profile from inventory-api GET /api/v1/{tenantSlug}/auth/me.
 * This syncs service-level RBAC roles and permissions after SSO login.
 * Uses the shared apiClient so auth headers and tenant context are attached automatically.
 */
export async function fetchInventoryProfile(tenantSlug: string): Promise<{
    id: string;
    email: string;
    fullName: string;
    roles: string[];
    permissions: string[];
    tenant_id: string;
    tenant_slug: string;
    isPlatformOwner: boolean;
    isSuperUser: boolean;
    email_verification?: import('@bengo-hub/shared-ui-lib/auth').EmailVerificationState;
}> {
    const data = await apiClient.get<{
        id: string;
        email: string;
        tenant_id: string;
        tenant_slug: string;
        roles: string[];
        permissions: string[];
        is_platform_owner: boolean;
        is_superuser: boolean;
        email_verification?: import('@bengo-hub/shared-ui-lib/auth').EmailVerificationState;
    }>(`/api/v1/${tenantSlug}/auth/me`);

    const roles: string[] = Array.isArray(data.roles) ? data.roles : [];
    return {
        id: data.id ?? '',
        email: data.email ?? '',
        fullName: data.email ?? '',
        roles,
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        tenant_id: data.tenant_id ?? '',
        tenant_slug: data.tenant_slug ?? tenantSlug,
        isPlatformOwner: data.is_platform_owner === true,
        email_verification: data.email_verification,
        // Honour the server's is_superuser flag (set for tenant admins/owners) and recognise
        // tenant-admin role aliases directly, so a tenant admin always gets full access.
        isSuperUser: data.is_superuser === true || roles.some((r) => ADMIN_ROLE_ALIASES.has(r.toLowerCase())),
    };
}

/** Global role names that grant full tenant access in inventory-ui. Mirrors the API mapping. */
export const ADMIN_ROLE_ALIASES = new Set([
    'superuser', 'admin', 'administrator', 'super_admin', 'inventory_admin',
    'tenant_admin', 'tenant-admin', 'tenantadmin', 'owner', 'account_owner',
    'org_admin', 'orgadmin', 'organization_admin', 'proprietor', 'director',
]);

const SSO_BASE_URL = process.env.NEXT_PUBLIC_SSO_URL || 'https://sso.codevertexitsolutions.com';
const SSO_CLIENT_ID = process.env.NEXT_PUBLIC_SSO_CLIENT_ID || 'inventory-ui';

export interface AuthorizeParams {
    codeChallenge: string;
    state: string;
    redirectUri: string;
    scope?: string;
    /** Pass explicitly so token is minted for this tenant (e.g. orgSlug from route). */
    tenant?: string;
}

export interface TokenExchangeParams {
    code: string;
    codeVerifier: string;
    redirectUri: string;
}

export function buildAuthorizeUrl({ codeChallenge, state, redirectUri, scope, tenant: tenantParam }: AuthorizeParams): string {
    const url = new URL('/api/v1/authorize', SSO_BASE_URL);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', SSO_CLIENT_ID);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('scope', scope || 'openid profile email offline_access');
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');

    const tenant = tenantParam ?? (typeof window !== 'undefined' ? localStorage.getItem('tenantSlug') : null);
    if (tenant) {
        url.searchParams.set('tenant', tenant);
    }

    return url.toString();
}

export function buildLogoutUrl(postLogoutRedirectUri?: string): string {
    const url = new URL('/api/v1/auth/logout', SSO_BASE_URL);
    if (postLogoutRedirectUri) {
        url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri);
    }
    return url.toString();
}

export async function revokeServerSession(accessToken?: string | null): Promise<void> {
  try {
    await fetch(new URL('/api/v1/auth/logout', SSO_BASE_URL).toString(), {
      method: 'POST',
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      credentials: 'include',
      keepalive: true,
    });
  } catch {
    /* best-effort: still clear local state + redirect below */
  }
}

export async function exchangeCodeForTokens(params: TokenExchangeParams) {
    const body = new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: params.redirectUri,
        client_id: SSO_CLIENT_ID,
        code_verifier: params.codeVerifier,
    });

    const response = await fetch(`${SSO_BASE_URL}/api/v1/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error_description || errorData.error || 'Token exchange failed');
    }

    return response.json();
}

export async function refreshTokens(refreshToken: string): Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
}> {
    const response = await fetch(`${SSO_BASE_URL}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken, client_id: SSO_CLIENT_ID }),
    });
    if (!response.ok) throw new Error('Token refresh failed');
    return response.json();
}

/**
 * Fetch user profile from SSO auth-api (not backend — avoids JIT sync delay).
 * SSO always has the user immediately after login; backend may still be syncing via NATS.
 */
export async function fetchProfile(accessToken?: string): Promise<{
    id: string;
    email: string;
    fullName: string;
    roles: string[];
    permissions: string[];
    tenant_id: string;
    tenant_slug: string;
    isPlatformOwner: boolean;
    isSuperUser: boolean;
    tenant?: Record<string, unknown>;
}> {
    const token = accessToken ?? (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${SSO_BASE_URL}/api/v1/auth/me`, { headers });
    if (!res.ok) {
        const err: any = new Error(res.status === 401 ? 'Unauthorized' : 'SSO /me failed');
        err.response = { status: res.status };
        throw err;
    }
    const data = await res.json();
    const roles: string[] = Array.isArray(data.roles) ? data.roles : [];
    return {
        id: data.id ?? '',
        email: data.email ?? '',
        fullName: data.fullName ?? data.full_name ?? data.email ?? '',
        roles,
        permissions: Array.isArray(data.permissions) ? data.permissions : [],
        tenant_id: data.tenant_id ?? '',
        tenant_slug: data.tenant_slug ?? '',
        isPlatformOwner: data.is_platform_owner === true || (data.tenant_slug ?? '') === 'codevertex',
        isSuperUser: roles.includes('superuser'),
        tenant: data.tenant,
    };
}
