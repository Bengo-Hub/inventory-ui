'use client';

/**
 * Presentational hero band for the inventory PIN-login screen — adapted from the library/pos-ui
 * PIN login design (brand-tinted band, glow, curved wave bottom, masked passcode + Login button).
 * Purely presentational: all state/handlers come from the page.
 */

import { useEffect, useState } from 'react';
import { Store, ChevronRight, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  return (
    <div className="text-right text-white">
      <p className="text-lg font-black tracking-tight tabular-nums leading-none">
        {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
      <p className="text-[10px] font-medium text-white/70 mt-1">
        {now.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
      </p>
    </div>
  );
}

export interface LoginHeroProps {
  eyebrow: string;
  heading: string;
  subline: string;
  logoUrl?: string | null;
  fallbackInitials: string;
  isHQ?: boolean;
  showSwitchOutlet?: boolean;
  onSwitchOutlet?: () => void;
  passcode?: {
    length: number;
    error?: boolean;
    shake?: boolean;
    onSubmit: () => void;
    isSubmitting?: boolean;
  };
}

export function LoginHero({
  eyebrow, heading, subline, logoUrl, fallbackInitials, isHQ,
  showSwitchOutlet, onSwitchOutlet, passcode,
}: LoginHeroProps) {
  return (
    <div
      className={cn('relative shrink-0 overflow-hidden', passcode && 'pb-12 sm:pb-14')}
      style={{ background: 'linear-gradient(135deg, rgb(var(--brand-dark)) 0%, hsl(var(--primary)) 130%)' }}
    >
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgb(var(--brand-dark) / 0.82) 0%, hsl(var(--primary) / 0.62) 100%)' }} />
      <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full blur-3xl" style={{ background: 'hsl(var(--primary) / 0.35)' }} />
      <div className="pointer-events-none absolute -left-20 top-1/3 h-40 w-40 rounded-full ring-1 ring-inset ring-white/10" style={{ background: 'hsl(var(--primary) / 0.12)' }} />

      <div className="relative z-10 px-5 sm:px-8 pt-5 pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="h-12 w-12 shrink-0 rounded-2xl bg-white/95 ring-1 ring-white/40 shadow-lg flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {logoUrl ? <img src={logoUrl} alt="" className="h-9 w-9 object-contain" /> : <span className="text-sm font-black text-slate-900">{fallbackInitials}</span>}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-white/65">{eyebrow}</p>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight truncate">{heading}</h1>
              <div className="flex items-center gap-2 flex-wrap mt-1">
                <span className="text-sm font-semibold text-white/85 truncate max-w-[16rem]">{subline}</span>
                {isHQ && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/15 text-white ring-1 ring-inset ring-white/20">
                    <Store className="h-2.5 w-2.5" />HQ
                  </span>
                )}
              </div>
              {showSwitchOutlet && (
                <button onClick={onSwitchOutlet} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-white/75 hover:text-white transition-colors group">
                  <ChevronRight className="h-3 w-3 rotate-90 group-hover:-translate-y-px transition-transform" /> Switch outlet
                </button>
              )}
            </div>
          </div>
          <div className="hidden sm:block shrink-0"><LiveClock /></div>
        </div>

        <div className="sm:hidden mt-4 flex justify-center"><LiveClock /></div>

        {passcode && (
          <div className="mt-5 sm:mt-6 flex items-center justify-center gap-2.5 sm:gap-3">
            <div className={cn(
              'flex h-12 min-w-48 sm:min-w-64 items-center gap-3 rounded-full bg-white px-5 shadow-lg ring-1 ring-black/5 transition-all',
              passcode.error && 'ring-2 ring-destructive', passcode.shake && 'animate-shake',
            )}>
              <Lock className={cn('h-4 w-4 shrink-0', passcode.error ? 'text-destructive' : 'text-slate-400')} />
              {passcode.length === 0 ? (
                <span className="text-sm font-medium text-slate-400">Enter PIN</span>
              ) : (
                <div className="flex items-center gap-1.5">
                  {Array.from({ length: passcode.length }).map((_, i) => (
                    <span key={i} className={cn('h-2.5 w-2.5 rounded-full', passcode.error ? 'bg-destructive' : 'bg-slate-700')} />
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={passcode.onSubmit}
              disabled={passcode.isSubmitting || passcode.length === 0}
              className="h-12 rounded-full px-7 text-sm font-bold text-white shadow-lg ring-1 ring-inset ring-white/20 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(160deg, hsl(var(--primary)) 0%, hsl(var(--primary-dark)) 100%)' }}
            >
              {passcode.isSubmitting ? 'Signing in…' : 'Login'}
            </button>
          </div>
        )}
      </div>

      <svg className="absolute inset-x-0 bottom-0 z-20 h-8 w-full text-background sm:h-10" viewBox="0 0 1440 80" preserveAspectRatio="none" aria-hidden>
        <path fill="currentColor" d="M0,80 L0,40 C240,80 480,80 720,52 C960,24 1200,24 1440,52 L1440,80 Z" />
      </svg>
    </div>
  );
}
