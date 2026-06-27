'use client';

import { cn } from '@/lib/utils';
import { ChevronRight, Globe, Warehouse } from 'lucide-react';
import type { OutletInfo } from '@/store/outlet';

const USE_CASE_LABELS: Record<string, string> = {
  hospitality: 'Hospitality',
  quick_service: 'Quick Service',
  retail: 'Retail',
  pharmacy: 'Pharmacy',
  services: 'Services',
  cafe: 'Café',
  warehouse: 'Warehouse',
  logistics: 'Logistics',
  manufacturing: 'Manufacturing',
};

/**
 * OutletCard — a single selectable outlet row in the outlet-login gate.
 * Clean, modern, capsule-styled, semantic-token only. Used for both real
 * outlets and (via the dedicated variant) the HQ "All Outlets" option.
 */
export function OutletCard({
  outlet,
  lastUsed,
  selecting,
  disabled,
  onSelect,
}: {
  outlet: OutletInfo;
  lastUsed?: boolean;
  selecting?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const useCaseLabel = USE_CASE_LABELS[outlet.use_case ?? ''] ?? outlet.use_case;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border bg-card hover:bg-accent hover:border-primary/30 transition-all duration-200 text-left group disabled:opacity-60"
    >
      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
        <Warehouse className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold text-foreground truncate">{outlet.name}</p>
          {lastUsed && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
              Last used
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground font-mono">{outlet.code}</span>
          {useCaseLabel && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent text-muted-foreground">
              {useCaseLabel}
            </span>
          )}
          {outlet.is_hq && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              HQ
            </span>
          )}
        </div>
      </div>
      {selecting ? (
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
      ) : (
        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      )}
    </button>
  );
}

/**
 * AllOutletsCard — the HQ-only "view across all outlets" option.
 */
export function AllOutletsCard({
  selecting,
  disabled,
  onSelect,
}: {
  selecting?: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5',
        'hover:bg-primary/10 hover:border-primary/50 transition-all duration-200 text-left group disabled:opacity-60',
      )}
    >
      <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 group-hover:bg-primary/25 transition-colors">
        {selecting ? (
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        ) : (
          <Globe className="h-5 w-5 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-primary">All Outlets</p>
        <p className="text-xs text-muted-foreground mt-0.5">View data across all warehouses & outlets</p>
      </div>
      <ChevronRight className="h-4 w-4 text-primary/50 group-hover:text-primary transition-colors shrink-0" />
    </button>
  );
}
