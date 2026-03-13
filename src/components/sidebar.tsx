import { useMe } from '@/hooks/useMe';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/auth';
import {
    ClipboardList,
    LayoutDashboard,
    LogOut,
    Package,
    Settings,
    Shield,
    Warehouse,
    X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { useBranding } from '@/providers/branding-provider';

interface SidebarProps {
    open?: boolean;
    onClose?: () => void;
}

const mainRoutesConfig: Array<{
    label: string;
    icon: typeof LayoutDashboard;
    href: string;
    permission?: string;
}> = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '' },
    { label: 'Catalog', icon: Package, href: '/catalog', permission: 'items:read' },
    { label: 'Warehouses', icon: Warehouse, href: '/warehouses', permission: 'warehouses:read' },
    { label: 'Adjustments', icon: ClipboardList, href: '/adjustments', permission: 'adjustments:read' },
    { label: 'Settings', icon: Settings, href: '/settings' },
];

function canSeeRoute(
    item: (typeof mainRoutesConfig)[0],
    hasRole: (r: string) => boolean,
    hasPermission: (p: string) => boolean
) {
    if (item.permission && !hasPermission(item.permission)) return false;
    return true;
}

export function Sidebar({ open = false, onClose }: SidebarProps) {
    const pathname = usePathname();
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const session = useAuthStore((s) => s.session);
    const logout = useAuthStore((s) => s.logout);
    const { hasRole, hasPermission } = useMe(!!session);
    const { tenant } = useBranding();
    const isPlatformOwner = orgSlug === 'codevertex';

    const routes = mainRoutesConfig
        .filter((item) => canSeeRoute(item, hasRole, hasPermission))
        .map((item) => ({
            label: item.label,
            icon: item.icon,
            href: `/${orgSlug}${item.href}`,
            active: item.href === '' ? pathname === `/${orgSlug}` : pathname.startsWith(`/${orgSlug}${item.href}`),
        }));

    const adminRoutes = [
        {
            label: 'Platform Admin',
            icon: Shield,
            href: `/${orgSlug}/platform`,
            active: pathname.startsWith(`/${orgSlug}/platform`),
        },
    ];

    const content = (
        <div className="space-y-4 py-4 flex flex-col h-full bg-brand-dark text-brand-light border-r border-white/10 min-w-[260px]">
            <div className="px-6 py-4 flex-1">
                <div className="flex items-center justify-between mb-12">
                    <Link href={`/${orgSlug}`} onClick={onClose} className="flex items-center">
                        {tenant?.logoUrl ? (
                            <img src={tenant.logoUrl} alt={tenant.name} className="h-10 w-auto object-contain" />
                        ) : (
                            <div className="w-10 h-10 bg-brand-orange rounded-xl flex items-center justify-center shadow-glow-orange">
                                <Package className="text-white h-6 w-6" />
                            </div>
                        )}
                    </Link>
                    <button onClick={onClose} className="md:hidden opacity-80 hover:opacity-100 p-2">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="space-y-2">
                    {routes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            onClick={onClose}
                            className={cn(
                                "group flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300",
                                route.active 
                                    ? "bg-brand-orange text-white shadow-glow-orange" 
                                    : "opacity-70 hover:opacity-100 hover:bg-white/5"
                            )}
                        >
                            <route.icon className={cn("h-5 w-5", route.active ? "text-white" : "text-brand-beige")} />
                            <span className="font-bold tracking-tight">{route.label}</span>
                        </Link>
                    ))}
                </div>

                {isPlatformOwner && (
                    <div className="mt-8 pt-8 border-t border-white/10">
                        <div className="px-6 mb-4 text-[10px] text-brand-beige uppercase tracking-[0.2em] font-black opacity-50">
                            Platform
                        </div>
                        <div className="space-y-2">
                            {adminRoutes.map((route) => (
                                <Link
                                    key={route.href}
                                    href={route.href}
                                    onClick={onClose}
                                    className={cn(
                                        "group flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300",
                                        route.active 
                                            ? "bg-brand-orange text-white shadow-glow-orange" 
                                            : "opacity-70 hover:opacity-100 hover:bg-white/5"
                                    )}
                                >
                                    <route.icon className={cn("h-5 w-5", route.active ? "text-white" : "text-brand-beige")} />
                                    <span className="font-bold tracking-tight">{route.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="px-6 py-6 border-t border-white/10 mt-auto">
                <div className="flex items-center gap-4 px-6 py-4 opacity-70">
                    <div className="w-8 h-8 rounded-xl bg-brand-orange/20 flex items-center justify-center text-xs font-black text-brand-orange uppercase">
                        {tenant?.name?.[0] || orgSlug?.[0]}
                    </div>
                    <span className="font-bold tracking-tight truncate flex-1 uppercase text-xs opacity-70">{tenant?.name || orgSlug}</span>
                    <button
                        onClick={() => logout()}
                        className="p-2 rounded-xl hover:bg-white/5 transition-colors text-brand-beige hover:text-red-400"
                        title="Sign out"
                    >
                        <LogOut className="h-5 w-5" />
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            {open && (
                <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden />
            )}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col transition-transform duration-300 md:static md:z-auto md:translate-x-0",
                    open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
                )}
            >
                <div className="flex-1 overflow-y-auto">{content}</div>
            </aside>
        </>
    );
}
