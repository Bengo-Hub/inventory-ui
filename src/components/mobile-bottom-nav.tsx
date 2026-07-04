'use client';

import { cn } from '@/lib/utils';
import { P, usePermissions } from '@/hooks/usePermissions';
import { useOutletStore } from '@/store/outlet';
import { nomenclatureFor } from '@/lib/use-case-nomenclature';
import {
  ArrowRightLeft, BookOpen, ChefHat, ClipboardCheck, ClipboardList, LayoutDashboard,
  Menu as MenuIcon, Package, Plus, Tag, Truck, X,
} from 'lucide-react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, type ComponentType } from 'react';

interface Props {
  /** Opens the full navigation drawer (the sidebar) for the "More" tab. */
  onOpenMenu: () => void;
}

interface QuickAction {
  label: string;
  href: string;       // route to navigate to (create dialogs auto-open via ?create=…)
  Icon: ComponentType<{ className?: string }>;
  show: boolean;
}

/**
 * MobileBottomNav — app-style bottom navigation for phones/tablets (hidden ≥ lg). Gives one-tap
 * access to the primary destinations and a prominent central "+" that opens a quick-add
 * sheet of the most common create actions (add item, new menu item, adjust stock, …),
 * so the create buttons buried in page toolbars are always reachable on mobile.
 */
export function MobileBottomNav({ onOpenMenu }: Props) {
  const params = useParams();
  const orgSlug = params?.orgSlug as string;
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { can, canAny, isSuperuser } = usePermissions();
  const useCase = useOutletStore((s) => s.outlet?.use_case);
  const noun = nomenclatureFor(useCase).item;
  const isFood = !useCase || ['hospitality', 'quick_service'].includes(useCase);

  const [addOpen, setAddOpen] = useState(false);

  // Close the sheet on route change.
  useEffect(() => { setAddOpen(false); }, [pathname]);

  const base = `/${orgSlug}`;
  const allow = (perm: string) => isSuperuser || can(perm);

  const tabs = [
    { label: 'Home', href: base, Icon: LayoutDashboard, match: (p: string) => p === base },
    { label: nomenclatureFor(useCase).catalog, href: `${base}/catalog`, Icon: Package, match: (p: string) => p.startsWith(`${base}/catalog`) },
    { label: 'Stock', href: `${base}/stock`, Icon: BookOpen, match: (p: string) => p.startsWith(`${base}/stock`) && !p.startsWith(`${base}/stock-take`) },
    { label: 'Adjust', href: `${base}/adjustments`, Icon: ClipboardList, match: (p: string) => p.startsWith(`${base}/adjustments`) },
  ];

  const actions: QuickAction[] = [
    { label: `Add ${noun}`,      href: `${base}/catalog?create=item`,      Icon: Package,        show: allow(P.CATALOG_ADD) },
    { label: 'New Menu Item',    href: `${base}/catalog/new-menu-item`,    Icon: ChefHat,        show: isFood && allow(P.CATALOG_ADD) },
    { label: 'Adjust Stock',     href: `${base}/adjustments?create=1`,     Icon: ClipboardList,  show: canAny([P.ADJUSTMENTS_ADD, P.STOCK_ADD, P.STOCK_MANAGE]) || isSuperuser },
    { label: 'Stock Take',       href: `${base}/stock-take?create=1`,      Icon: ClipboardCheck, show: canAny([P.STOCK_COUNT_ADD, P.STOCK_MANAGE]) || isSuperuser },
    { label: 'New Transfer',     href: `${base}/transfers?create=1`,       Icon: ArrowRightLeft, show: allow(P.TRANSFERS_ADD) },
    { label: 'New Requisition',  href: `${base}/requisitions?create=1`,    Icon: Truck,          show: isSuperuser || can('inventory.requisitions.add') },
    { label: 'New Category',     href: `${base}/categories?create=1`,      Icon: Tag,            show: allow(P.CATALOG_ADD) },
  ];
  const visibleActions = actions.filter((a) => a.show);

  return (
    <>
      {/* Quick-add bottom sheet */}
      {addOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAddOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-popover border-t border-border shadow-2xl pb-[calc(env(safe-area-inset-bottom)+1rem)] animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-base font-bold">Quick add</h2>
              <button onClick={() => setAddOpen(false)} aria-label="Close" className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 px-4 pt-1">
              {visibleActions.map((a) => (
                <button
                  key={a.label}
                  onClick={() => { setAddOpen(false); router.push(a.href); }}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 text-center hover:bg-accent active:scale-95 transition-all"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <a.Icon className="h-5 w-5" />
                  </span>
                  <span className="text-[11px] font-semibold leading-tight text-foreground">{a.label}</span>
                </button>
              ))}
              {visibleActions.length === 0 && (
                <p className="col-span-3 py-6 text-center text-sm text-muted-foreground">No create actions available.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom tab bar */}
      <nav className="lg:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-5 items-end h-16">
          {tabs.slice(0, 2).map((t) => <Tab key={t.label} {...t} active={t.match(pathname)} />)}

          {/* Center elevated "+" */}
          <div className="flex items-end justify-center">
            <button
              onClick={() => setAddOpen(true)}
              aria-label="Quick add"
              className="mb-2 flex h-14 w-14 -translate-y-3 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition-transform"
            >
              <Plus className="h-7 w-7" />
            </button>
          </div>

          {tabs.slice(2).map((t) => <Tab key={t.label} {...t} active={t.match(pathname)} />)}

          <button
            onClick={onOpenMenu}
            className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground active:text-foreground"
          >
            <MenuIcon className="h-5 w-5" />
            <span className="text-[10px] font-semibold leading-none">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}

function Tab({ label, href, Icon, active }: { label: string; href: string; Icon: ComponentType<{ className?: string }>; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex h-full flex-col items-center justify-center gap-1 transition-colors',
        active ? 'text-primary' : 'text-muted-foreground active:text-foreground',
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="max-w-full truncate text-[10px] font-semibold leading-none">{label}</span>
    </Link>
  );
}
