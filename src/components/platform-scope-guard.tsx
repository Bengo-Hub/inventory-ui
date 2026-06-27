'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { apiClient } from '@/lib/api/client';

/**
 * PlatformScopeGuard — confines any cross-tenant "platform drill-in" to the
 * `/platform` section, so every normal business page is always scoped to the
 * platform owner's OWN tenant (codevertex).
 *
 * Model "Dedicated Platform section" (see
 * .claude/plans/platform-owner-self-tenant-separation.md): the main app
 * `/{orgSlug}/*` = the owner's own business by default; cross-tenant
 * administration is confined to `/{orgSlug}/platform/*`. Leaving `/platform`
 * must clear the drill-in.
 *
 * inventory-ui has no `?tenantId=` cross-tenant selector today — own-tenant
 * scoping is driven entirely by the JWT's own tenant claim via
 * `apiClient.setTenantInfo(...)` (always the owner's own tenant). The only
 * platform-scoped lever on the API client is `setPlatformOwner()`, which (when
 * true) suppresses the `X-Tenant-*` headers so the backend falls back to the
 * caller's own tenant claim. This guard keeps that lever pinned OFF on every
 * non-platform route, so business pages can never accidentally drop their
 * own-tenant headers, and provides the canonical home for clearing a future
 * cross-tenant drill-in when one is added.
 */
export function PlatformScopeGuard() {
  const pathname = usePathname();

  useEffect(() => {
    const onPlatform = !!pathname && pathname.includes('/platform');
    // Off /platform → ensure own-tenant scoping (no platform header suppression,
    // no lingering cross-tenant drill-in). On /platform the platform section may
    // opt into a drill-in itself.
    if (!onPlatform) {
      apiClient.setPlatformOwner(false);
    }
  }, [pathname]);

  return null;
}
