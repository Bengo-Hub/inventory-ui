'use client';

import { getBranding } from '@/lib/api/branding';
import { getTenantBySlug } from '@/lib/api/tenant';
import { useAuthStore } from '@/store/auth';
import { useParams } from 'next/navigation';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

interface BrandingContextType {
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  orgName: string;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

const fallback = {
  logoUrl: '/logo.png',
  primaryColor: '#0ea5e9',
  secondaryColor: '#6366f1',
  orgName: '',
};

export function BrandingProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const orgSlug =
    (params?.orgSlug as string) ||
    (typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_TENANT_SLUG : null) ||
    '';
  const accessToken = useAuthStore((s) => s.session?.accessToken ?? null);
  const [branding, setBranding] = useState<BrandingContextType>(fallback);

  useEffect(() => {
    if (!orgSlug) {
      setBranding((b) => ({ ...b, ...fallback }));
      return;
    }
    let cancelled = false;
    (async () => {
      const tenant = await getTenantBySlug(orgSlug);
      if (cancelled || !tenant) {
        setBranding((b) => ({ ...b, orgName: orgSlug }));
        return;
      }
      const data = await getBranding(tenant.id, accessToken);
      if (cancelled) return;
      const next = {
        logoUrl: data.logo_url || fallback.logoUrl,
        primaryColor: data.primary_color || fallback.primaryColor,
        secondaryColor: data.secondary_color || fallback.secondaryColor,
        orgName: tenant.name || orgSlug,
      };
      setBranding(next);
      document.documentElement.style.setProperty('--primary', next.primaryColor);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgSlug, accessToken]);

  return (
    <BrandingContext.Provider value={branding}>
      {children}
    </BrandingContext.Provider>
  );
}

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) return fallback;
  return context;
};
