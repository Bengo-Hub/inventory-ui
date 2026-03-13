'use client';

import { useAuthStore } from '@/store/auth';
import { Menu, Package, Search, User } from 'lucide-react';
import { useParams } from 'next/navigation';
import { ThemeToggle } from './theme-toggle';

function displayName(user: { fullName?: string; name?: string; email?: string } | null): string {
  if (!user) return 'Account';
  return user.fullName ?? user.name ?? user.email?.split('@')[0] ?? 'Account';
}

interface HeaderProps {
    onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
    const user = useAuthStore((state) => state.user);
    const session = useAuthStore((state) => state.session);
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const isAuthenticated = !!user && !!session;
    const name = displayName(user);
    const role = user?.roles?.[0];

    return (
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-xl sticky top-0 z-50 flex items-center justify-between px-6">
            <div className="flex items-center gap-4 flex-1">
                <button type="button" onClick={onMenuClick} className="md:hidden p-2 rounded-lg hover:bg-accent transition" aria-label="Open menu">
                    <Menu className="h-5 w-5 text-muted-foreground" />
                </button>
                <div className="flex items-center gap-2 md:hidden">
                    <Package className="h-5 w-5 text-primary" />
                    <span className="font-bold text-sm">Inventory</span>
                </div>
                <div className="relative max-w-sm w-full group hidden md:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        placeholder="Search items, SKUs..."
                        className="w-full bg-accent/50 border-none rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary transition-all bg-transparent border border-muted"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                <ThemeToggle />

                <div className="h-8 w-[1px] bg-border mx-1"></div>

                {isAuthenticated && (
                <div className="flex items-center gap-3 pl-2">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold leading-none">{name}</p>
                        {role ? <p className="text-xs text-muted-foreground mt-1 capitalize">{role}</p> : null}
                    </div>
                    <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold border border-border shadow-sm">
                        {name[0]?.toUpperCase() ?? <User className="h-5 w-5" />}
                    </div>
                </div>
                )}
            </div>
        </header>
    );
}
