'use client';

import { cn } from '@/lib/utils';
import {
  ArrowRightLeft,
  ChefHat,
  ChevronDown,
  ClipboardList,
  FileText,
  Key,
  LayoutDashboard,
  Layers,
  LogOut,
  Monitor,
  Package,
  Settings,
  Shield,
  SquareStack,
  Truck,
  Warehouse,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useState } from 'react';
import { useBranding } from '@/providers/branding-provider';
import { useAuthStore } from '@/store/auth';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
}

interface NavGroup {
  label: string;
  defaultCollapsed?: boolean;
  items: NavItem[];
}

// ── Nav link ──────────────────────────────────────────────────────────────────

function NavLink({ item, orgSlug, onClose }: { item: NavItem; orgSlug: string; onClose?: () => void }) {
  const pathname = usePathname();
  const href = `/${orgSlug}${item.href}`;
  const active = item.href === '' ? pathname === `/${orgSlug}` : pathname.startsWith(href);
  const Icon = item.icon;

  return (
    <Link
      href={href}
      onClick={onClose}
      className={cn(
        'group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-sm',
        active
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 font-semibold'
          : 'text-white/55 hover:text-white hover:bg-white/8 font-medium'
      )}
    >
      <Icon className={cn('h-4.5 w-4.5 shrink-0 transition-transform duration-200', !active && 'group-hover:scale-110')} />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

// ── Collapsible group ─────────────────────────────────────────────────────────

function NavGroupSection({
  group,
  orgSlug,
  onClose,
  initialOpen,
}: {
  group: NavGroup;
  orgSlug: string;
  onClose?: () => void;
  initialOpen: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 mb-1 py-0.5 group/header"
        aria-expanded={open}
      >
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/25 group-hover/header:text-white/40 transition-colors">
          {group.label}
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-white/20 transition-all duration-200 group-hover/header:text-white/40',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <div className="space-y-0.5">
          {group.items.map((item) => (
            <NavLink key={item.href + item.label} item={item} orgSlug={orgSlug} onClose={onClose} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const params = useParams();
  const pathname = usePathname();
  const orgSlug = params?.orgSlug as string;
  const { tenant, getServiceTitle } = useBranding();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const isPlatformOwner = orgSlug === 'codevertex';

  // ── Nav groups ────────────────────────────────────────────────────────────

  const navGroups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, href: '' },
      ],
    },
    {
      label: 'Catalog',
      items: [
        { label: 'Items', icon: Package, href: '/catalog' },
        { label: 'Recipes / BOM', icon: ChefHat, href: '/recipes' },
        { label: 'Modifiers', icon: SquareStack, href: '/modifiers' },
      ],
    },
    {
      label: 'Warehouse',
      items: [
        { label: 'Warehouses', icon: Warehouse, href: '/warehouses' },
        { label: 'Adjustments', icon: ClipboardList, href: '/adjustments' },
        { label: 'Transfers', icon: ArrowRightLeft, href: '/transfers' },
        { label: 'Lots & Batches', icon: Layers, href: '/lots' },
      ],
    },
    {
      label: 'Procurement',
      defaultCollapsed: true,
      items: [
        { label: 'Purchase Orders', icon: FileText, href: '/purchase-orders' },
        { label: 'Suppliers', icon: Truck, href: '/suppliers' },
      ],
    },
    {
      label: 'Management',
      defaultCollapsed: true,
      items: [
        { label: 'Settings', icon: Settings, href: '/settings' },
      ],
    },
  ];

  function isGroupInitiallyOpen(group: NavGroup): boolean {
    if (!group.defaultCollapsed) return true;
    return group.items.some((item) => {
      const href = `/${orgSlug}${item.href}`;
      return item.href === '' ? pathname === `/${orgSlug}` : pathname?.startsWith(href);
    });
  }

  // ── User display ──────────────────────────────────────────────────────────

  const displayName = user?.fullName || tenant?.orgName || orgSlug;
  const displayInitial = displayName?.[0]?.toUpperCase() ?? '?';

  // ── Content ───────────────────────────────────────────────────────────────

  const content = (
    <div className="flex flex-col h-full bg-brand-dark border-r border-white/8">
      {/* Logo / tenant */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/8">
        {tenant?.logoUrl ? (
          <img src={tenant.logoUrl} alt={tenant.name ?? orgSlug} className="h-9 w-auto object-contain" />
        ) : (
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30 shrink-0">
            <span className="text-sm font-bold text-primary-foreground">
              {(tenant?.orgName ?? orgSlug).slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{tenant?.orgName ?? orgSlug}</p>
          <p className="text-[10px] text-white/35 mt-0.5">{getServiceTitle('Inventory')}</p>
        </div>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5 scrollbar-hide">
        {navGroups.map((group) => (
          <NavGroupSection
            key={group.label}
            group={group}
            orgSlug={orgSlug}
            onClose={onClose}
            initialOpen={isGroupInitiallyOpen(group)}
          />
        ))}

        {/* Platform section — superuser only */}
        {isPlatformOwner && (
          <div>
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white/25">
              Platform
            </p>
            <div className="space-y-0.5">
              <NavLink item={{ label: 'Platform Admin', icon: Shield, href: '/platform' }} orgSlug={orgSlug} onClose={onClose} />
              <NavLink item={{ label: 'Devices', icon: Monitor, href: '/platform/devices' }} orgSlug={orgSlug} onClose={onClose} />
              <NavLink item={{ label: 'Licenses', icon: Key, href: '/platform/licenses' }} orgSlug={orgSlug} onClose={onClose} />
            </div>
          </div>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-white/8">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5">
          <div className="h-8 w-8 rounded-lg bg-primary/25 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{displayInitial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{displayName}</p>
            <p className="text-[10px] text-white/40 mt-0.5">Inventory</p>
          </div>
          <button
            onClick={() => logout()}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-white/35 hover:text-rose-400 hover:bg-white/8 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-300',
          'lg:sticky lg:top-0 lg:h-screen lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Mobile header bar */}
        <div className="flex h-14 items-center justify-between border-b border-white/8 px-4 lg:hidden bg-brand-dark">
          <span className="text-sm font-semibold text-white">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">{content}</div>
      </aside>
    </>
  );
}
