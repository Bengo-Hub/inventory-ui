'use client';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { ReactNode } from 'react';

/**
 * DetailDrawer — a reusable slide-over (built on the shared Sheet) for showing a record's full
 * details. Built ONCE and reused across every inventory list page so view-details is a
 * consistent drawer (instead of page-nav or per-page modals).
 *
 * Layout:
 *   - sticky header: title + optional subtitle + optional status badge(s)
 *   - scrollable body: a `fields` definition list (label/value pairs) + arbitrary `children`
 *     (line-item tables, panels, etc.)
 *   - optional sticky footer: action buttons (Send, Receive, Approve, Print…)
 *
 * Pages pass `loading` while the detail query is in-flight; the drawer renders a skeleton.
 */
export interface DetailField {
  label: string;
  value: ReactNode;
  /** Span the full width (e.g. notes / addresses). Default fields are half-width on sm+. */
  full?: boolean;
  /** Hide the field entirely when its value is empty. */
  hideIfEmpty?: boolean;
}

interface DetailDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Status badges / chips rendered next to the title. */
  badges?: ReactNode;
  /** Definition-list of label/value pairs rendered at the top of the body. */
  fields?: DetailField[];
  /** Action buttons rendered in a sticky footer. */
  actions?: ReactNode;
  loading?: boolean;
  width?: 'sm' | 'md' | 'lg';
  children?: ReactNode;
}

function isEmpty(v: ReactNode): boolean {
  return v == null || v === '' || v === '—';
}

export function DetailDrawer({
  open,
  onClose,
  title,
  subtitle,
  badges,
  fields,
  actions,
  loading,
  width = 'lg',
  children,
}: DetailDrawerProps) {
  const visibleFields = (fields ?? []).filter((f) => !(f.hideIfEmpty && isEmpty(f.value)));

  return (
    <Sheet open={open} onClose={onClose} width={width}>
      {/* Fill the Sheet's scroll container with our own flex-col so header + footer stay sticky
          while the field/children body scrolls. */}
      <div className="flex h-full flex-col">
        {/* Header — kept here (not Sheet's own title) so we can include badges/subtitle. */}
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-border shrink-0">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-bold text-foreground truncate">{title}</h2>
              {badges}
            </div>
            {subtitle && <p className="text-sm text-muted-foreground truncate">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <SheetContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-4 rounded bg-muted/50 animate-pulse" style={{ width: `${70 - i * 10}%` }} />
                ))}
              </div>
            ) : (
              <>
                {visibleFields.length > 0 && (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                    {visibleFields.map((f, i) => (
                      <div key={i} className={f.full ? 'sm:col-span-2' : ''}>
                        <dt className="text-muted-foreground">{f.label}</dt>
                        <dd className="font-medium mt-1 break-words">{isEmpty(f.value) ? '—' : f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {children}
              </>
            )}
          </SheetContent>
        </div>

        {actions && !loading && (
          <div className="border-t border-border px-6 py-4 shrink-0 flex flex-wrap gap-2 justify-end bg-background">
            {actions}
          </div>
        )}
      </div>
    </Sheet>
  );
}
