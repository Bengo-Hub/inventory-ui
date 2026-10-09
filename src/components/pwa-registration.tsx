'use client';

import { PwaInstallPrompt } from '@bengo-hub/shared-ui-lib/offline';
import { serviceAppName } from '@bengo-hub/shared-ui-lib/branding';
import { useBranding } from '@/providers/branding-provider';
import { requestAppPermissions } from '@/hooks/use-app-permissions';

const DISMISS_KEY = 'inv_pwa_install_dismissed_until';

export function PWARegistration() {
  const { tenant } = useBranding();

  // App name = tenant brand word + service, e.g. "The Urban Inventory" (shared rule, see
  // shared-ui-lib branding). Keeps installed apps distinguishable for one tenant.
  const appName = serviceAppName(tenant?.orgName, 'Inventory', 'Codevertex');

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
