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
        <div className="space-y-4 py-6 flex flex-col h-full bg-brand-dark text-white border-r border-white/10 min-w-[280px]">
            <div className="px-6 py-4 flex flex-col h-full overflow-y-auto custom-scrollbar">
                <Link href={`/${orgSlug}`} onClick={onClose} className="flex items-center justify-center mb-10 transition-all hover:scale-105 duration-500">
                    {tenant?.logoUrl ? (
                        <img src={tenant.logoUrl} alt={tenant.name} className="h-12 w-auto object-contain drop-shadow-2xl" />
                    ) : (
                        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                            <Package className="text-white h-6 w-6" />
                        </div>
                    )}
                </Link>

                <div className="space-y-1 mt-4">
                    <div className="px-6 pb-2">
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                            Operations
                        </p>
                    </div>
                    {routes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            onClick={onClose}
                            className={cn(
                                "group flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300",
                                route.active 
                                    ? "bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]" 
                                    : "text-white/50 hover:bg-white/5 hover:text-white"
                            )}
                        >
                            <route.icon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", route.active ? "text-white" : "group-hover:text-white")} />
                            <span className="font-bold text-xs uppercase tracking-widest">{route.label}</span>
                        </Link>
                    ))}
                </div>

                {isPlatformOwner && (
                    <div className="mt-8 pt-8 border-t border-white/10">
                        <div className="px-6 mb-4 text-[10px] text-white/30 uppercase tracking-[0.2em] font-black">
                            Platform
                        </div>
                        <div className="space-y-1">
                            {adminRoutes.map((route) => (
                                <Link
                                    key={route.href}
                                    href={route.href}
                                    onClick={onClose}
                                    className={cn(
                                        "group flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300",
                                        route.active 
                                            ? "bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]" 
                                            : "text-white/50 hover:bg-white/5 hover:text-white"
                                    )}
                                >
                                    <route.icon className={cn("h-5 w-5 transition-transform duration-300 group-hover:scale-110", route.active ? "text-white" : "group-hover:text-white")} />
                                    <span className="font-bold text-xs uppercase tracking-widest">{route.label}</span>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="p-6 border-t border-white/10 mt-auto">
                <div className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-white/5 text-white/70">
                    <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-xs font-black text-primary uppercase shadow-inner">
                        {tenant?.name?.[0] || orgSlug?.[0]}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                        <span className="font-black text-[10px] uppercase tracking-widest truncate">{tenant?.name || orgSlug}</span>
                        <span className="text-[9px] font-bold opacity-50 uppercase tracking-tighter">Inventory Node</span>
                    </div>
                    <button
                        onClick={() => logout()}
                        className="p-2 rounded-xl hover:bg-white/5 transition-colors text-white/50 hover:text-rose-400"
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
                    "fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col transition-transform duration-300 md:sticky md:top-0 md:h-screen md:z-auto md:translate-x-0 md:min-w-[280px]",
                    open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
                )}
            >
                <div className="flex-1 overflow-y-auto">{content}</div>
            </aside>
        </>
    );
}
