'use client';

import { cn } from '@/lib/utils';
import { Delete } from 'lucide-react';
import { useEffect, useState } from 'react';

interface PinPadProps {
  /** Number of digits in the PIN. */
  length?: number;
  /** Called when the PIN reaches `length`. Return false to reject (triggers shake + clear). */
  onComplete: (pin: string) => void | boolean | Promise<void | boolean>;
  /** External error flag — when true, the dots shake and clear. */
  error?: boolean;
  /** Disable input (e.g. while verifying). */
  disabled?: boolean;
  className?: string;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'] as const;

/**
 * PinPad — a modern, branded numeric keypad with masked dots, clear/backspace,
 * and a subtle error shake. Reusable for any PIN/passcode entry (outlet login,
 * manager step-up, etc.). Pure UI — auth logic lives in the caller's onComplete.
 *
 * Styling uses semantic / tenant-branding tokens only (no hardcoded colors),
 * large touch targets, and capsule controls per the UI/UX design standard.
 */
export function PinPad({ length = 4, onComplete, error = false, disabled = false, className }: PinPadProps) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  // External error → shake + clear.
  useEffect(() => {
    if (error) {
      setShake(true);
      setPin('');
      const t = setTimeout(() => setShake(false), 450);
      return () => clearTimeout(t);
    }
  }, [error]);

  const press = (key: string) => {
    if (disabled) return;
    if (key === 'clear') {
      setPin('');
      return;
    }
    if (key === 'back') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    setPin((p) => {
      if (p.length >= length) return p;
      const next = p + key;
      if (next.length === length) {
        // Defer so the final dot renders before verification.
        setTimeout(async () => {
          const ok = await onComplete(next);
          if (ok === false) {
            setShake(true);
            setPin('');
            setTimeout(() => setShake(false), 450);
          } else {
            setPin('');
          }
        }, 80);
      }
      return next;
    });
  };

  // Hardware keyboard support.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (disabled) return;
      if (e.key >= '0' && e.key <= '9') press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Escape') press('clear');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, length]);

  return (
    <div className={cn('flex flex-col items-center gap-8', className)}>
      {/* Masked dots */}
      <div className={cn('flex items-center gap-4', shake && 'animate-shake')}>
        {Array.from({ length }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-4 w-4 rounded-full border-2 transition-all duration-150',
              i < pin.length
                ? 'bg-primary border-primary scale-110'
                : 'bg-transparent border-muted-foreground/30',
            )}
          />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {KEYS.map((key) => {
          if (key === 'clear') {
            return (
              <button
                key={key}
                type="button"
                onClick={() => press('clear')}
                disabled={disabled}
                className="h-16 w-16 sm:h-18 sm:w-18 rounded-full flex items-center justify-center text-xs font-bold uppercase tracking-wider text-muted-foreground hover:bg-accent active:scale-95 transition-all disabled:opacity-40"
              >
                Clear
              </button>
            );
          }
          if (key === 'back') {
            return (
              <button
                key={key}
                type="button"
                onClick={() => press('back')}
                disabled={disabled}
                aria-label="Backspace"
                className="h-16 w-16 sm:h-18 sm:w-18 rounded-full flex items-center justify-center text-muted-foreground hover:bg-accent active:scale-95 transition-all disabled:opacity-40"
              >
                <Delete className="h-6 w-6" />
              </button>
            );
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              disabled={disabled}
              className="h-16 w-16 sm:h-18 sm:w-18 rounded-full flex items-center justify-center text-2xl font-bold text-foreground bg-card border border-border shadow-sm hover:bg-accent hover:border-primary/30 active:scale-95 transition-all disabled:opacity-40"
            >
              {key}
            </button>
          );
        })}
      </div>
    </div>
  );
}
