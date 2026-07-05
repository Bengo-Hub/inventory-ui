'use client';

/** On-screen QWERTY keyboard for alphanumeric PINs — adapted from the library/pos-ui keyboard.
 *  Presentational only; the page owns the passcode state and submit path. */

import React from 'react';
import { ArrowBigUp, CornerDownLeft, Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROWS: string[][] = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];

export interface QwertyKeyboardProps {
  onKey: (char: string) => void;
  onBackspace: () => void;
  onEnter: () => void;
  shift: boolean;
  onToggleShift: () => void;
  /** When provided, a "?123" key switches to the numeric keypad (small-screen single-keyboard mode). */
  onToggleNumeric?: () => void;
  disabled?: boolean;
}

function Key({ label, onPress, disabled, className, style }: {
  label: React.ReactNode; onPress: () => void; disabled?: boolean; className?: string; style?: React.CSSProperties;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      style={style}
      className={cn(
        'flex h-11 min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl',
        'bg-card text-foreground text-sm font-semibold border border-border shadow-sm',
        'hover:border-primary/40 active:scale-95 transition-all duration-100 touch-manipulation select-none',
        'disabled:opacity-40 disabled:pointer-events-none',
        className,
      )}
    >
      {label}
    </button>
  );
}

export function QwertyKeyboard({ onKey, onBackspace, onEnter, shift, onToggleShift, onToggleNumeric, disabled }: QwertyKeyboardProps) {
  const cased = (c: string) => (shift ? c.toUpperCase() : c);
  return (
    <div className="flex w-full flex-col gap-1.5 sm:gap-2">
      <div className="flex gap-1.5">
        {ROWS[0].map((c) => <Key key={c} label={cased(c)} disabled={disabled} onPress={() => onKey(cased(c))} />)}
        <Key label={<Delete className="h-4 w-4" />} disabled={disabled} onPress={onBackspace} className="flex-[1.4] bg-muted text-muted-foreground" />
      </div>
      <div className="flex gap-1.5 px-3">
        {ROWS[1].map((c) => <Key key={c} label={cased(c)} disabled={disabled} onPress={() => onKey(cased(c))} />)}
        <Key
          label={<span className="flex items-center gap-1 text-xs font-bold"><CornerDownLeft className="h-3.5 w-3.5" />Enter</span>}
          disabled={disabled}
          onPress={onEnter}
          className="flex-[2] text-white border-transparent hover:opacity-90"
          style={{ background: 'linear-gradient(160deg, hsl(var(--primary)) 0%, hsl(var(--primary-dark)) 100%)' }}
        />
      </div>
      <div className="flex gap-1.5">
        <Key label={<ArrowBigUp className="h-4 w-4" />} disabled={disabled} onPress={onToggleShift}
          className={cn('flex-[1.6]', shift ? 'bg-primary/15 text-primary border-primary/40' : 'bg-muted text-muted-foreground')} />
        {ROWS[2].map((c) => <Key key={c} label={cased(c)} disabled={disabled} onPress={() => onKey(cased(c))} />)}
        <Key label="," disabled={disabled} onPress={() => onKey(',')} className="bg-accent/40" />
        <Key label="." disabled={disabled} onPress={() => onKey('.')} className="bg-accent/40" />
      </div>
      <div className="flex gap-1.5">
        {onToggleNumeric && (
          <Key label="?123" disabled={disabled} onPress={onToggleNumeric} className="flex-[1.6] bg-muted text-muted-foreground font-bold" />
        )}
        <Key label={<span className="text-[11px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">Space</span>} disabled={disabled} onPress={() => onKey(' ')} className="flex-1" />
      </div>
    </div>
  );
}
