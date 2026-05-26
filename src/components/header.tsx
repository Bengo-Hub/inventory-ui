'use client';

import { useAuthStore } from '@/store/auth';
import { useRef, useState } from 'react';
import { Bell, BookOpen, ChevronDown, ExternalLink, Globe, LogOut, Menu, Search, Settings, ShoppingCart, Tag, User } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { useBranding } from '@/providers/branding-provider';
import { OutletFilter } from './outlet-filter';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const POS_URL = process.env.NEXT_PUBLIC_POS_UI_URL ?? 'https://pos.codevertexitsolutions.com';
const TREASURY_URL = process.env.NEXT_PUBLIC_TREASURY_UI_URL ?? 'https://books.codevertexitsolutions.com';
const PRICING_URL = process.env.NEXT_PUBLIC_SUBSCRIPTIONS_UI_URL ?? 'https://pricing.codevertexitsolutions.com';
const ORDERING_URL = process.env.NEXT_PUBLIC_ORDERING_UI_URL ?? 'https://order.codevertexitsolutions.com';
const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_UI_URL ?? 'https://accounts.codevertexitsolutions.com';

const SERVICES = [
  { label: 'POS',            href: (slug: string) => `${POS_URL}/${slug}`,      Icon: ShoppingCart },
  { label: 'Treasury',       href: (slug: string) => `${TREASURY_URL}/${slug}`,  Icon: BookOpen },
  { label: 'Online Store',   href: (slug: string) => `${ORDERING_URL}/${slug}`,  Icon: Globe },
  { label: 'Subscriptions',  href: (slug: string) => `${PRICING_URL}/${slug}`,   Icon: Tag },
  { label: 'Account Portal', href: (slug: string) => `${AUTH_URL}/${slug}`,      Icon: Globe },
] as const;

function displayName(user: { fullName?: string; name?: string; email?: string } | null): string {
  if (!user) return 'Account';
  return user.fullName ?? user.name ?? user.email?.split('@')[0] ?? 'Account';
}

interface HeaderProps {
  onMenuClick?: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const params = useParams();
  const orgSlug = (params?.orgSlug as string) || 'codevertex';
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const logout = useAuthStore((state) => state.logout);
  const { getServiceTitle } = useBranding();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const isAuthenticated = !!user && !!session;
  const name = displayName(user);
  const role = user?.roles?.[0];

  return (
    <header className="h-20 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <button
          type="button"
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-xl hover:bg-accent transition-colors"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5 text-muted-foreground" />
        </button>
        <div className="flex items-center gap-6">
          <h1 className="text-lg sm:text-xl font-black tracking-tight text-foreground uppercase truncate max-w-[150px] sm:max-w-none">
            {getServiceTitle('Inventory')}
          </h1>
          <div className="hidden md:flex relative w-80 max-w-full group ml-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              placeholder="Search items, SKUs..."
              className="w-full h-10 bg-accent/50 border-none rounded-xl py-1.5 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary/30 transition-all outline-none"
            />
          </div>
          <OutletFilter className="hidden md:block" />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        <button className="relative group p-2.5 rounded-xl hover:bg-accent transition-all">
          <Bell className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-background" />
        </button>

        <ThemeToggle />

        <div className="h-8 w-[1px] bg-border mx-1 hidden sm:block" />

        {isAuthenticated && (
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="flex items-center gap-3 rounded-2xl hover:bg-accent p-1 transition-all group"
              aria-expanded={profileOpen}
              aria-haspopup="true"
              aria-label="Open profile menu"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center font-bold text-xs shadow-sm transition-transform group-hover:scale-105">
                {name[0]?.toUpperCase() ?? <User className="h-5 w-5" />}
              </div>
              <div className="hidden md:block text-left mr-1">
                <p className="text-xs font-black text-foreground truncate max-w-[120px]">{name}</p>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{role || 'Manager'}</p>
              </div>
              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${profileOpen ? 'rotate-180' : ''}`} />
            </button>

            {profileOpen && (
              <>
                <div className="fixed inset-0 z-40" aria-hidden="true" onClick={() => setProfileOpen(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-[1.5rem] p-3 shadow-2xl border border-border bg-popover overflow-hidden">
                  <div className="mb-2 px-3 py-2">
                    <p className="text-sm font-black text-foreground">{name}</p>
                    <p className="text-[10px] text-muted-foreground truncate font-bold uppercase tracking-widest mt-0.5">{role || 'Manager'}</p>
                  </div>

                  <div className="h-px bg-border my-2 mx-1" />

                  <div className="grid gap-1">
                    <Link
                      href={`/${orgSlug}/settings`}
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-foreground/70 hover:bg-accent hover:text-foreground transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center group-hover:text-primary transition-colors">
                        <Settings className="h-4 w-4" />
                      </div>
                      Settings
                    </Link>
                  </div>

                  <div className="h-px bg-border my-2 mx-1" />

                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-3 mb-1.5">Services</p>
                  <div className="grid gap-1">
                    {SERVICES.map(({ label, href, Icon }) => (
                      <a
                        key={label}
                        href={href(orgSlug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-foreground/70 hover:bg-accent hover:text-foreground transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center group-hover:text-primary transition-colors">
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="flex-1">{label}</span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground opacity-60" />
                      </a>
                    ))}
                  </div>

                  <div className="h-px bg-border my-2 mx-1" />

                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      void logout();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-rose-600 hover:bg-rose-500/10 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center transition-colors">
                      <LogOut className="h-4 w-4" />
                    </div>
                    Logout
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
