'use client';

import { AlertTriangle } from 'lucide-react';
import type { DuplicateNameMatch } from '@/hooks/useDuplicateNameWarning';

interface Props<T extends { id: string; name: string }> {
  matches: DuplicateNameMatch<T>[];
  /** e.g. "supplier", "item", "menu item". Used in the message copy. */
  entityLabel: string;
  /** Render a secondary line under each matched name (e.g. SKU, contact person). */
  renderDetail?: (item: T) => string | undefined;
  /** When given, each match becomes a button so the user can pick it instead of creating a new one. */
  onUseExisting?: (item: T) => void;
  className?: string;
}

// Soft, non-blocking "you might be creating a duplicate" banner. Shared by the
// Supplier / Item / Menu Item create forms so the warning looks and behaves the
// same everywhere — this is informational, never disables submit.
export function DuplicateNameWarning<T extends { id: string; name: string }>({
  matches,
  entityLabel,
  renderDetail,
  onUseExisting,
  className,
}: Props<T>) {
  if (matches.length === 0) return null;
  const hasExact = matches.some((m) => m.exact);

  return (
    <div
      className={`rounded-lg border border-amber-300/60 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-950/30 p-3 space-y-2 ${className ?? ''}`}
    >
      <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          {hasExact
            ? <>A {entityLabel} named <strong>&quot;{matches[0].item.name}&quot;</strong> already exists.</>
            : <>This looks similar to {matches.length === 1 ? 'an existing' : 'existing'} {entityLabel}{matches.length > 1 ? 's' : ''} — double-check it isn&apos;t a duplicate.</>}
        </span>
      </p>
      <ul className="space-y-1">
        {matches.map(({ item, exact }) => {
          const detail = renderDetail?.(item);
          const content = (
            <span className="min-w-0">
              <span className="font-medium truncate">{item.name}</span>
              {exact && <span className="ml-1.5 text-xs text-amber-700 dark:text-amber-400">(exact match)</span>}
              {detail && <span className="block text-xs text-amber-700/80 dark:text-amber-400/80 truncate">{detail}</span>}
            </span>
          );
          return (
            <li key={item.id}>
              {onUseExisting ? (
                <button
                  type="button"
                  onClick={() => onUseExisting(item)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-amber-300/60 dark:border-amber-500/30 bg-white/60 dark:bg-black/10 px-2.5 py-1.5 text-left text-sm hover:bg-white dark:hover:bg-black/20 transition-colors"
                >
                  {content}
                  <span className="shrink-0 text-xs font-medium text-amber-800 dark:text-amber-300">Use this instead</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 rounded-md bg-white/40 dark:bg-black/10 px-2.5 py-1.5 text-sm">
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
