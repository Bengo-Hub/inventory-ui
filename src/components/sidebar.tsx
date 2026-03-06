'use client';

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
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

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

export function Sidebar() {
    const pathname = usePathname();
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const session = useAuthStore((s) => s.session);
    const logout = useAuthStore((s) => s.logout);
    const { hasRole, hasPermission } = useMe(!!session);
    const isAdmin = hasRole('super_admin') || hasRole('admin');

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

    return (
        <div className="hidden md:flex space-y-4 py-4 flex-col h-full bg-card border-r border-border min-w-[240px]">
            <div className="px-3 py-2 flex-1">
                <Link href={`/${orgSlug}`} className="flex items-center pl-3 mb-14">
                    <div className="relative w-8 h-8 mr-3 bg-primary rounded-lg flex items-center justify-center">
                        <Package className="text-primary-foreground h-5 w-5" />
                    </div>
                    <h1 className="text-xl font-bold tracking-tight">
                        Inventory
                    </h1>
                </Link>
                <div className="space-y-1">
                    {routes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            className={cn(
                                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:bg-accent/50 rounded-lg transition",
                                route.active ? "bg-accent text-foreground" : "text-muted-foreground"
                            )}
                        >
                            <div className="flex items-center flex-1">
                                <route.icon className={cn("h-5 w-5 mr-3", route.active ? "text-primary" : "text-muted-foreground")} />
                                {route.label}
                            </div>
                        </Link>
                    ))}
                </div>

                {isAdmin && (
                    <div className="mt-6 pt-4 border-t border-border">
                        <div className="px-3 mb-2 text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                            Platform
                        </div>
                        <div className="space-y-1">
                            {adminRoutes.map((route) => (
                                <Link
                                    key={route.href}
                                    href={route.href}
                                    className={cn(
                                        "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:bg-accent/50 rounded-lg transition",
                                        route.active ? "bg-accent text-foreground" : "text-muted-foreground"
                                    )}
                                >
                                    <div className="flex items-center flex-1">
                                        <route.icon className={cn("h-5 w-5 mr-3", route.active ? "text-primary" : "text-muted-foreground")} />
                                        {route.label}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="px-3 py-2 border-t border-border">
                <div className="p-3 text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                    Organization
                </div>
                <div className="flex items-center px-3 py-2 gap-3 text-sm font-medium">
                    <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary capitalize">
                        {orgSlug?.[0]}
                    </div>
                    <span className="capitalize flex-1">{orgSlug?.replace('-', ' ')}</span>
                    <button
                        onClick={() => logout()}
                        className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition"
                        title="Sign out"
                    >
                        <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                </div>
            </div>
        </div>
    );
}
