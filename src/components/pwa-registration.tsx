'use client';

import { PwaInstallPrompt } from '@bengo-hub/shared-ui-lib/offline';
import { useBranding } from '@/providers/branding-provider';
import { requestAppPermissions } from '@/hooks/use-app-permissions';

const DISMISS_KEY = 'inv_pwa_install_dismissed_until';

export function PWARegistration() {
  const { tenant } = useBranding();

  // App name = tenant's first word + service, e.g. "Urban Inventory". Keeps
  // installed apps distinguishable when several Bengo apps run for one tenant.
  const tenantFirstWord = tenant?.orgName?.trim().split(/\s+/)[0];
  const appName = tenantFirstWord ? `${tenantFirstWord} Inventory` : 'Codevertex Inventory';

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
