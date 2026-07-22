import { fetchTenantBySlug, type TenantBrand } from '@/lib/api/tenant';
import { useParams } from 'next/navigation';
import { createContext, ReactNode, useContext, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

function hexToRgbTriplet(hex: string): string {
  const t = hex.replace(/^#/, '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return '107 42 27';
  return `${parseInt(t.slice(0, 2), 16)} ${parseInt(t.slice(2, 4), 16)} ${parseInt(t.slice(4, 6), 16)}`;
}

function hexToDarkRgbTriplet(hex: string): string {
  // Very dark tonal variant (L=7%, S=38%) of the brand hue — used for deep surfaces (e.g. the
  // PIN-login brand panel gradient). Mirrors pos-ui/library-ui's branding provider so the same
  // shared PinLoginLayout renders identically across services.
  const raw = hex.replace(/^#/, '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(raw)) return '23 37 84';
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h = 0;
  if (max !== mn) {
    const d = max - mn;
    h = max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6
      : max === g ? ((b - r) / d + 2) / 6
      : ((r - g) / d + 4) / 6;
  }
  const hDeg = Math.round(h * 360);
  // Fixed low lightness/mid saturation — convert HSL(hDeg, 38%, 7%) to an RGB triplet.
  const s = 0.38, l = 0.07;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hDeg / 60) % 2) - 1));
  const m = l - c / 2;
  let [r2, g2, b2] = [0, 0, 0];
  if (hDeg < 60) [r2, g2, b2] = [c, x, 0];
  else if (hDeg < 120) [r2, g2, b2] = [x, c, 0];
  else if (hDeg < 180) [r2, g2, b2] = [0, c, x];
  else if (hDeg < 240) [r2, g2, b2] = [0, x, c];
  else if (hDeg < 300) [r2, g2, b2] = [x, 0, c];
  else [r2, g2, b2] = [c, 0, x];
  return `${Math.round((r2 + m) * 255)} ${Math.round((g2 + m) * 255)} ${Math.round((b2 + m) * 255)}`;
}

function hexToHslTriplet(hex: string): string {
  const t = hex.replace(/^#/, '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(t)) return '24 91% 50%';
  const r = parseInt(t.slice(0, 2), 16) / 255;
  const g = parseInt(t.slice(2, 4), 16) / 255;
  const b = parseInt(t.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

interface BrandingContextType {
  slug: string;
  tenant: TenantBrand | null;
  isLoading: boolean;
  error: Error | null;
  getServiceTitle: (appName: string) => string;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

const DEFAULT_BRAND: TenantBrand = {
  id: 'platform',
  name: 'Codevertex',
  slug: 'codevertex',
  logoUrl: '/logo/logo.png',
  primaryColor: '#ea8022',
  secondaryColor: '#ae6221',
  orgName: 'Codevertex Africa Limited',
  useCase: 'other',
};

export function BrandingProvider({ children }: { children: ReactNode }) {
  const params = useParams();
  const slug = (params?.orgSlug as string) || '';

  const { data: tenant, isLoading, error } = useQuery({
    queryKey: ['tenant', slug],
    queryFn: () => fetchTenantBySlug(slug),
    staleTime: 6 * 60 * 60 * 1000, // 6 hours — aligned with JWT TTL
    enabled: !!slug,
  });

  const effectiveBrand = useMemo(() => {
    if (tenant) return tenant;
    if (!isLoading && !tenant && slug) {
      return { ...DEFAULT_BRAND, slug, name: slug, orgName: slug };
    }
    return DEFAULT_BRAND;
  }, [tenant, isLoading, slug]);

  useMemo(() => {
    if (typeof window !== 'undefined') {
      const primary = effectiveBrand?.primaryColor || DEFAULT_BRAND.primaryColor!;
      const secondary = effectiveBrand?.secondaryColor || DEFAULT_BRAND.secondaryColor!;
      const logo = effectiveBrand?.logoUrl || DEFAULT_BRAND.logoUrl!;
      const root = document.documentElement;

      root.style.setProperty('--tenant-primary', primary);
      root.style.setProperty('--tenant-secondary', secondary);
      root.style.setProperty('--tenant-logo-url', `url(${logo})`);
      // Drive Tailwind semantic tokens from tenant brand color
      root.style.setProperty('--primary', hexToHslTriplet(primary));
      root.style.setProperty('--ring', hexToHslTriplet(primary));
      // Drive brand RGB triplets for bg-brand-primary / bg-brand-emphasis
      root.style.setProperty('--brand-primary', hexToRgbTriplet(primary));
      root.style.setProperty('--brand-emphasis', hexToRgbTriplet(secondary));
      // Deep-surface variants (PIN-login brand panel gradient + darker primary button state).
      root.style.setProperty('--brand-dark', hexToDarkRgbTriplet(primary));
      const hue = hexToHslTriplet(primary).split(' ')[0];
      root.style.setProperty('--primary-dark', `${hue} 68% 40%`);
    }
  }, [effectiveBrand]);

  const getServiceTitle = (appName: string) => {
    const tenantName = effectiveBrand?.orgName || effectiveBrand?.name || '';
    const firstWord = tenantName.split(' ')[0] || 'Codevertex';
    return `${firstWord} ${appName}`;
  };

  const value = useMemo(
    () => ({
      slug,
      tenant: effectiveBrand,
      isLoading,
      error: error as Error | null,
      getServiceTitle,
    }),
    [slug, effectiveBrand, isLoading, error]
  );

  return (
    <BrandingContext.Provider value={value}>
      {children}
    </BrandingContext.Provider>
  );
}

export const useBranding = () => {
  const context = useContext(BrandingContext);
  if (!context) {
    return {
      slug: '',
      tenant: null,
      isLoading: false,
      error: null,
      getServiceTitle: (s: string) => s,
    };
  }
  return context;
};
