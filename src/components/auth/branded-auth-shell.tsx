'use client';

import { Package } from 'lucide-react';
import { ReactNode } from 'react';
import { useBranding } from '@/providers/branding-provider';

/**
 * BrandedAuthShell — the shared, modern, tenant-branded panel used by the
 * outlet/login gate screens (login, select-outlet). Centered card on a soft
 * branded backdrop, tenant logo header, title/subtitle, then children.
 *
 * Semantic / tenant-branding tokens only (no hardcoded colors). Default light
 * theme. Reusable across every pre-dashboard auth screen.
 */
export function BrandedAuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const { tenant } = useBranding();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-b from-background via-background to-primary/5">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          {tenant?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tenant.logoUrl}
              alt={tenant.name ?? 'Logo'}
              className="h-14 w-auto max-w-[220px] object-contain"
            />
          ) : (
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Package className="h-7 w-7 text-primary-foreground" />
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-border bg-card/80 backdrop-blur shadow-xl shadow-primary/5 p-8 animate-scale-in">
          <div className="text-center mb-7">
            <h1 className="text-2xl font-black tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
          </div>
          {children}
        </div>

        {footer && <div className="mt-6 text-center">{footer}</div>}
      </div>
    </div>
  );
}
