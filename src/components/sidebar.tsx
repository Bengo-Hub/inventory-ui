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
    X,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

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
        <div className="space-y-4 py-4 flex flex-col h-full bg-card border-r border-border min-w-[240px]">
            <div className="px-3 py-2 flex-1">
                <Link href={`/${orgSlug}`} onClick={onClose} className="flex items-center pl-3 mb-14">
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
                            onClick={onClose}
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

                {isPlatformOwner && (
                    <div className="mt-6 pt-4 border-t border-border">
                        <div className="px-3 mb-2 text-xs text-muted-foreground uppercase tracking-widest font-semibold">
                            Platform
                        </div>
                        <div className="space-y-1">
                            {adminRoutes.map((route) => (
                                <Link
                                    key={route.href}
                                    href={route.href}
                                    onClick={onClose}
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

    return (
        <>
            {open && (
                <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} aria-hidden />
            )}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-border bg-card transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:min-w-[240px]",
                    open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
                )}
            >
                <div className="flex h-14 items-center justify-between border-b border-border px-4 md:hidden">
                    <span className="text-sm font-bold text-foreground">Menu</span>
                    <button type="button" onClick={onClose} className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close menu">
                        <X className="size-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto">{content}</div>
            </aside>
        </>
    );
}
