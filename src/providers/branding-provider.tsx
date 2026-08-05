import { useParams } from 'next/navigation';
import { ReactNode } from 'react';
import {
  TenantBrandingProvider as SharedTenantBrandingProvider,
  useTenantBranding as useSharedTenantBranding,
} from '@bengo-hub/shared-ui-lib/tenant';

const AUTH_API_URL =
  process.env.NEXT_PUBLIC_AUTH_API_URL ||
  process.env.NEXT_PUBLIC_SSO_URL ||
  'https://sso.codevertexafrica.com';

/**
 * inventory-ui had no cache of its own for tenant branding, so this is a pure upgrade to the
 * shared module's default (dependency-free, native-IndexedDB) cache adapter — no injection
 * needed here, unlike pos-ui's Dexie-backed one.
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const slug = (params?.orgSlug as string) || '';

  return (
    <SharedTenantBrandingProvider slug={slug} authApiBase={AUTH_API_URL}>
      {children}
    </SharedTenantBrandingProvider>
  );
}

export const useBranding = useSharedTenantBranding;
