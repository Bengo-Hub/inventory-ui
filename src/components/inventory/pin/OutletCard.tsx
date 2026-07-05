'use client';

/** Outlet selection card for the PIN-login outlet step — adapted from the library BranchCard. */

import { Store, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface OutletCardData {
  id: string;
  name: string;
  code?: string;
  is_default?: boolean;
}

export function OutletCard({ outlet, index, onSelect }: { outlet: OutletCardData; index: number; onSelect: () => void }) {
  const accent = 'hsl(var(--primary))';
  return (
    <button
      onClick={onSelect}
      style={{ animationDelay: `${index * 55}ms` }}
      className={cn(
        'group relative flex flex-col text-left rounded-2xl border overflow-hidden bg-card border-border',
        'hover:border-primary/40 shadow-sm hover:shadow-lg active:scale-[0.97] transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 animate-fade-up',
      )}
    >
      <div className="absolute top-0 inset-x-0 h-0.5 opacity-70 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }} />
      <div className="p-5 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/20">
            <Store className="h-5 w-5 text-primary transition-transform duration-200 group-hover:scale-110" />
          </div>
          {outlet.is_default && (
            <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-muted text-muted-foreground uppercase tracking-widest">HQ</span>
          )}
        </div>
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="font-bold text-foreground text-sm sm:text-base leading-snug truncate">{outlet.name}</p>
            {outlet.code && <p className="text-xs text-muted-foreground mt-0.5">{outlet.code}</p>}
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all shrink-0 mb-0.5" />
        </div>
      </div>
    </button>
  );
}
