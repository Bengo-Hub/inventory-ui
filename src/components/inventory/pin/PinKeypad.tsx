'use client';

/** Numeric keypad for the inventory PIN screen — adapted from the library/pos-ui PIN keypad.
 *  The masked passcode display lives in the LoginHero; this just emits digit/backspace/clear. */

import { Delete, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PinKeypadProps {
  onDigit: (d: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  /** When provided, an "ABC" key switches to the alphanumeric QWERTY keyboard. */
  onToggleQwerty?: () => void;
  disabled?: boolean;
  isSubmitting?: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function PinKeypad({ onDigit, onBackspace, onClear, onToggleQwerty, disabled, isSubmitting }: PinKeypadProps) {
  const btn = cn(
    'h-16 sm:h-[4.5rem] rounded-2xl text-2xl font-bold select-none',
    'bg-card border border-border shadow-sm',
    'hover:border-primary/40 active:scale-95 transition-all duration-100',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
    'disabled:opacity-50 disabled:pointer-events-none',
  );
  return (
    <div className="flex flex-col gap-2.5 sm:gap-3 mx-auto w-full max-w-xs">
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        {KEYS.map((k) => (
          <button key={k} type="button" disabled={disabled} onClick={() => onDigit(k)} className={btn}>{k}</button>
        ))}
        {onToggleQwerty ? (
          <button type="button" disabled={disabled} onClick={onToggleQwerty} className={cn(btn, 'text-sm font-black uppercase tracking-wider text-muted-foreground')} aria-label="Letters keyboard">ABC</button>
        ) : (
          <button type="button" disabled={disabled} onClick={onClear} className={cn(btn, 'text-sm font-semibold text-muted-foreground')}>Clear</button>
        )}
        <button type="button" disabled={disabled} onClick={() => onDigit('0')} className={btn}>
          {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> : '0'}
        </button>
        <button type="button" disabled={disabled} onClick={onBackspace} className={cn(btn, 'flex items-center justify-center')} aria-label="Backspace">
          <Delete className="h-6 w-6" />
        </button>
      </div>
      {onToggleQwerty && (
        <button type="button" disabled={disabled} onClick={onClear} className="w-full rounded-2xl py-3 text-sm font-black uppercase tracking-wider text-destructive bg-destructive/10 border border-destructive/25 hover:bg-destructive/15 transition-colors disabled:opacity-50">Clear</button>
      )}
    </div>
  );
}
