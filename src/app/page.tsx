'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Bare-root landing. There's no tenant in the URL here, so route to the user's
 * last-used tenant (persisted at login) rather than a hardcoded default — a demo
 * user must never be bounced onto the `codevertex` platform tenant, which would
 * start SSO for the wrong tenant and fail with "not a member of the requested
 * tenant". Falls back to the public demo tenant when nothing is remembered
 * (matching auth-api's own unauthenticated default).
 */
const FALLBACK_TENANT = 'codevertex-demo';

export default function RootPage() {
  const router = useRouter();
  useEffect(() => {
    let slug = FALLBACK_TENANT;
    try {
      const stored = localStorage.getItem('tenantSlug');
      if (stored && stored.trim()) slug = stored.trim();
    } catch { /* ignore */ }
    router.replace(`/${slug}`);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-pulse text-muted-foreground">Loading…</div>
    </div>
  );
}
