'use client';

import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface AnchoredPortalProps {
  /** The trigger the panel hangs off (its bottom-left, or bottom-right when align="end"). */
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  /** Panel width in px — needed up front so it can be kept inside the viewport. */
  width: number;
  align?: 'start' | 'end';
  className?: string;
  children: ReactNode;
}

/**
 * AnchoredPortal — renders a dropdown panel on <body>, positioned (fixed) under its trigger.
 *
 * Use this for ANY dropdown opened from the app header (outlet / tenant filters etc.). The
 * header is a sticky, backdrop-blurred bar whose left group is `overflow-hidden` (needed so the
 * title and filters don't collide on tablet widths); an `absolute top-full` panel inside it is
 * clipped at the header's bottom edge — the dropdown opens but only its first row shows. That
 * regressed on 2026-09-23 when the overflow was added. Portalling to <body> makes the panel
 * immune to any ancestor's overflow, transform, backdrop-filter or z-index, so layout changes to
 * the header can't break it again. Same approach as pos-ui's HeaderOutletChip and the shared
 * SearchableCombobox.
 */
export function AnchoredPortal({ anchorRef, open, onClose, width, align = 'start', className, children }: AnchoredPortalProps) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const place = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const raw = align === 'end' ? r.right - width : r.left;
    setPos({ top: r.bottom + 4, left: Math.max(8, Math.min(raw, window.innerWidth - width - 8)) });
  }, [anchorRef, width, align]);

  // Measured before paint on every open, so a reopened panel never flashes at a stale spot.
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, place, onClose]);

  if (!open || !pos || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <div className="fixed inset-0 z-[90]" onClick={onClose} aria-hidden />
      <div
        className={cn('fixed z-[91] rounded-xl border border-border bg-popover shadow-xl flex flex-col', className)}
        style={{ top: pos.top, left: pos.left, width, maxHeight: `calc(100vh - ${pos.top + 8}px)` }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
