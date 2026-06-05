'use client';

import { cn } from '@/lib/utils';
import {
  ArrowRightLeft,
  BookOpen,
  Boxes,
  Calendar,
  ChefHat,
  ChevronDown,
  ClipboardCheck,
  ClipboardList,
  Factory,
  FileSignature,
  FileText,
  FolderTree,
  Key,
  LayoutDashboard,
  Layers,
  LogOut,
  Monitor,
  Package,
  RotateCcw,
  Ruler,
  Settings,
  Shield,
  ShieldCheck,
  SquareStack,
  Tag,
  Truck,
  Warehouse,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useState } from 'react';
import { useBranding } from '@/providers/branding-provider';
import { useAuthStore } from '@/store/auth';
import { useOutletStore } from '@/store/outlet';

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  /** Module key used for use_case filtering. Omit to always show. */
  moduleKey?: string;
}

interface NavGroup {
  label: string;
  defaultCollapsed?: boolean;
  items: NavItem[];
}

// ── Use-case module gating ────────────────────────────────────────────────────
// Maps outlet use_case to the set of module keys visible in the sidebar.
// Mirrors pos-ui's USE_CASE_MODULES pattern.

const USE_CASE_MODULES: Record<string, string[]> = {
  hospitality:   ['dashboard', 'catalog', 'categories', 'units', 'recipes', 'modifiers', 'warehouses', 'stock', 'adjustments', 'transfers', 'events', 'production_batches', 'assets', 'requisitions', 'approvals','settings'],
  quick_service: ['dashboard', 'catalog', 'categories', 'units', 'recipes', 'warehouses', 'stock', 'adjustments', 'production_batches', 'assets', 'requisitions', 'approvals','settings'],
  retail:        ['dashboard', 'catalog', 'categories', 'units', 'warehouses', 'stock', 'adjustments', 'transfers', 'lots', 'purchase_orders', 'returns', 'contracts', 'suppliers', 'requisitions', 'approvals','assets', 'settings'],
  pharmacy:      ['dashboard', 'catalog', 'categories', 'units', 'warehouses', 'stock', 'adjustments', 'lots', 'purchase_orders', 'returns', 'contracts', 'suppliers', 'requisitions', 'approvals','assets', 'settings'],
  services:      ['dashboard', 'catalog', 'categories', 'units', 'warehouses', 'stock', 'adjustments', 'events', 'assets', 'requisitions', 'approvals','settings'],
  warehouse:     ['dashboard', 'catalog', 'categories', 'units', 'warehouses', 'stock', 'adjustments', 'transfers', 'lots', 'purchase_orders', 'returns', 'contracts', 'production_batches', 'assets', 'requisitions', 'approvals','settings'],
  logistics:     ['dashboard', 'warehouses', 'stock', 'transfers', 'adjustments', 'assets', 'settings'],
};

const ADMIN_ROLES = ['admin', 'inventory_admin', 'manager', 'store_manager', 'superuser', 'super_admin'];

function hasModule(key: string | undefined, useCase: string | undefined, isAdmin: boolean): boolean {
  if (!key) return true; // no key = always visible
  if (isAdmin) return true; // admins see all modules
  const modules = USE_CASE_MODULES[useCase ?? ''] ?? USE_CASE_MODULES.hospitality;
  return modules.includes(key);
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
          : 'text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-foreground/8 font-medium'
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
        <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/25 group-hover/header:text-sidebar-foreground/40 transition-colors">
          {group.label}
        </span>
        <ChevronDown
          className={cn(
            'h-3 w-3 text-sidebar-foreground/20 transition-all duration-200 group-hover/header:text-sidebar-foreground/40',
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
  const { outlet, clearOutlet } = useOutletStore();
  const isPlatformOwner = orgSlug === 'codevertex';
  const isAdmin =
    !!user?.isPlatformOwner ||
    !!user?.isSuperUser ||
    !!(user?.roles ?? []).some((r) => ADMIN_ROLES.includes(r));

  async function handleLogout() {
    clearOutlet();
    await logout();
  }

  // ── Nav groups ────────────────────────────────────────────────────────────

  const useCase = outlet?.use_case;

  const allNavGroups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard', icon: LayoutDashboard, href: '', moduleKey: 'dashboard' },
      ],
    },
    {
      label: 'Catalog',
      items: [
        { label: 'Items', icon: Package, href: '/catalog', moduleKey: 'catalog' },
        { label: 'Categories', icon: Tag, href: '/categories', moduleKey: 'categories' },
        { label: 'Units', icon: Ruler, href: '/units', moduleKey: 'units' },
        { label: 'Recipes / BOM', icon: ChefHat, href: '/recipes', moduleKey: 'recipes' },
        { label: 'Modifiers', icon: SquareStack, href: '/modifiers', moduleKey: 'modifiers' },
      ],
    },
    {
      label: 'Events',
      items: [
        { label: 'Upcoming Events', icon: Calendar, href: '/events', moduleKey: 'events' },
        { label: 'Manage Events', icon: Calendar, href: '/events/manage', moduleKey: 'events' },
      ],
    },
    {
      label: 'Warehouse',
      items: [
        { label: 'Warehouses', icon: Warehouse, href: '/warehouses', moduleKey: 'warehouses' },
        { label: 'Stock Levels', icon: BookOpen, href: '/stock', moduleKey: 'stock' },
        { label: 'Adjustments', icon: ClipboardList, href: '/adjustments', moduleKey: 'adjustments' },
        { label: 'Transfers', icon: ArrowRightLeft, href: '/transfers', moduleKey: 'transfers' },
        { label: 'Lots & Batches', icon: Layers, href: '/lots', moduleKey: 'lots' },
      ],
    },
    {
      label: 'Procurement',
      defaultCollapsed: true,
      items: [
        { label: 'Requisitions', icon: ClipboardCheck, href: '/requisitions', moduleKey: 'requisitions' },
        { label: 'Purchase Orders', icon: FileText, href: '/purchase-orders', moduleKey: 'purchase_orders' },
        { label: 'Goods Receipts', icon: ClipboardCheck, href: '/goods-receipts', moduleKey: 'purchase_orders' },
        { label: 'Returns', icon: RotateCcw, href: '/returns', moduleKey: 'returns' },
        { label: 'Contracts', icon: FileSignature, href: '/contracts', moduleKey: 'contracts' },
        { label: 'Suppliers', icon: Truck, href: '/suppliers', moduleKey: 'suppliers' },
        { label: 'Approvals', icon: ShieldCheck, href: '/approvals', moduleKey: 'approvals' },
        { label: 'Approval Rules', icon: Shield, href: '/approvals/rules', moduleKey: 'approvals' },
      ],
    },
    {
      label: 'Manufacturing',
      defaultCollapsed: true,
      items: [
        { label: 'Production Batches', icon: Factory, href: '/production-batches', moduleKey: 'production_batches' },
      ],
    },
    {
      label: 'Assets',
      defaultCollapsed: true,
      items: [
        { label: 'Fixed Assets', icon: Boxes, href: '/assets', moduleKey: 'assets' },
        { label: 'Asset Categories', icon: FolderTree, href: '/asset-categories', moduleKey: 'assets' },
      ],
    },
    {
      label: 'Management',
      defaultCollapsed: true,
      items: [
        { label: 'Settings', icon: Settings, href: '/settings', moduleKey: 'settings' },
      ],
    },
  ];

  // Filter groups and items by outlet use_case (admins bypass gating)
  const navGroups = allNavGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasModule(item.moduleKey, useCase, isAdmin)),
    }))
    .filter((group) => group.items.length > 0);

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
    <div className="flex flex-col h-full bg-sidebar border-r border-sidebar-border">
      {/* Logo / tenant — proportional logo contained in 72px band, or pill fallback */}
      <div className="border-b border-sidebar-border shrink-0 overflow-hidden" style={{ height: '72px' }}>
        {tenant?.logoUrl ? (
          <div className="flex items-center h-full px-3 py-2">
            <img
              src={tenant.logoUrl}
              alt={tenant.name ?? orgSlug}
              className="h-full w-auto max-w-full object-contain"
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 h-full px-4">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <span className="text-sm font-bold text-primary-foreground">
                {(tenant?.orgName ?? orgSlug).slice(0, 2).toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-bold text-sidebar-foreground truncate">
              {tenant?.orgName ?? orgSlug}
            </span>
          </div>
        )}
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
            <p className="px-3 mb-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-sidebar-foreground/25">
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
      <div className="px-3 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-sidebar-foreground/5">
          <div className="h-8 w-8 rounded-lg bg-primary/25 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{displayInitial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-sidebar-foreground truncate">{displayName}</p>
            <p className="text-[10px] text-sidebar-foreground/40 mt-0.5">{outlet?.name ?? 'Inventory'}</p>
          </div>
          <button
            onClick={handleLogout}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-sidebar-foreground/35 hover:text-rose-400 hover:bg-sidebar-foreground/8 transition-colors"
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
          // Mobile: fixed overlay that slides in/out
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform duration-300',
          // Desktop: static flex child inside the fixed shell — reset inset so
          // the fixed-position mobile classes don't bleed through, h-full fills
          // the shell height, sticky is NOT used (it's disabled by overflow:hidden
          // ancestors and the shell is already viewport-locked via fixed inset-0)
          'lg:static lg:inset-auto lg:h-full lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Mobile header bar */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4 lg:hidden bg-sidebar">
          <span className="text-sm font-semibold text-sidebar-foreground">Menu</span>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-foreground/10 transition-colors"
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
