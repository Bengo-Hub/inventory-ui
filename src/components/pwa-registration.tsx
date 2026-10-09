'use client';

import { PwaInstallPrompt } from '@bengo-hub/shared-ui-lib/offline';
import { serviceAppName } from '@bengo-hub/shared-ui-lib/branding';
import { serviceBrandingFor } from '@bengo-hub/shared-ui-lib/tenant';
import { useBranding } from '@/providers/branding-provider';
import { requestAppPermissions } from '@/hooks/use-app-permissions';

const DISMISS_KEY = 'inv_pwa_install_dismissed_until';

export function PWARegistration() {
  const { tenant } = useBranding();

  // Same title as the header: the tenant's own Inventory name (Accounts > Branding) else
  // "<brand word> Inventory", e.g. "The Urban Inventory" (shared rule in shared-ui-lib branding).
  const appName = serviceAppName(tenant?.orgName, 'Inventory', 'Codevertex', serviceBrandingFor(tenant, 'inventory'));

  return (
    <PwaInstallPrompt
      appName={appName}
      logoUrl={tenant?.logoUrl}
      tagline="Track stock offline — syncs when reconnected."
      dismissKey={DISMISS_KEY}
      onInstalled={requestAppPermissions}
    />
  );
}
