'use client';

import { cn } from '@/lib/utils';
import { Info } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

interface InfoHintProps {
  /** Tooltip body. Plain text or rich nodes (e.g. formula lines). */
  children: ReactNode;
  /** Optional bold heading shown at the top of the bubble. */
  title?: string;
  /** Which side to prefer for the bubble. Default: top. */
  side?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  /** Icon size in px (default 14). */
  size?: number;
  /** Accessible label for the trigger (default "More info"). */
  label?: string;
}

const SIDE_CLS: Record<NonNullable<InfoHintProps['side']>, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
};

/**
 * InfoHint — a small info icon that reveals an explanatory bubble on hover or
 * focus (and tap on touch devices). Use it to explain ambiguous fields, cards,
 * or sections without cluttering the layout with permanent help text.
 */
export function InfoHint({ children, title, side = 'top', className, size = 14, label = 'More info' }: InfoHintProps) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <span className={cn('relative inline-flex align-middle', className)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="inline-flex items-center justify-center rounded-full text-muted-foreground/70 hover:text-foreground focus:text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
      >
        <Info style={{ width: size, height: size }} />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            'absolute z-[9999] w-64 max-w-[80vw] rounded-lg border border-border bg-popover px-3 py-2 text-left text-xs font-normal leading-relaxed text-popover-foreground shadow-xl',
            SIDE_CLS[side],
          )}
        >
          {title && <span className="mb-1 block font-semibold text-foreground">{title}</span>}
          <span className="block text-muted-foreground">{children}</span>
        </span>
      )}
    </span>
  );
}
