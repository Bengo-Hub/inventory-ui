'use client';

import { etimsApi, type EtimsCode } from '@/lib/api/etims';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Loader2, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  orgSlug: string;
  /** KRA code-list type: ITEM_CLS, PKG_UNIT, QTY_UNIT. */
  codeType: string;
  value: string;
  onChange: (code: string) => void;
  placeholder?: string;
  /** Extra server-side search seed (for the large ITEM_CLS list). Merged with typed query. */
  search?: string;
  className?: string;
}

const inputCls =
  'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';

/**
 * EtimsCodeSelect — a searchable combobox fed by the KRA eTIMS code lists (proxied from
 * treasury). The KRA classification list is huge, so search is debounced and re-queried
 * server-side (by name OR code) rather than filtering a fixed page client-side — nobody
 * should have to memorize tax codes. Each option shows the human-readable name with the
 * raw code as a muted hint.
 *
 * When the list is empty (tenant hasn't synced KRA code lists yet) it degrades to a
 * free-text input with a hint, so the field is never a dead end. The value emitted is
 * always the raw KRA code string the backend stores.
 */
export function EtimsCodeSelect({ orgSlug, codeType, value, onChange, placeholder, search, className }: Props) {
  const [open, setOpen] = useState(false);
  const [rawSearch, setRawSearch] = useState('');
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce the search term (300ms) so each keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => setQuery(rawSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [rawSearch]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  // Availability probe: is this code-list synced at all? Drives the free-text fallback.
  const probe = useQuery({
    queryKey: ['etims-codes', 'probe', orgSlug, codeType],
    queryFn: () => etimsApi.codeLists(orgSlug, codeType, undefined, 1),
    enabled: !!orgSlug,
    staleTime: 600_000,
  });

  // Resolve the current value's human name for the trigger label (edit mode: the row
  // may not be in the currently loaded search page).
  const resolved = useQuery({
    queryKey: ['etims-codes', 'resolve', orgSlug, codeType, value],
    queryFn: () => etimsApi.codeLists(orgSlug, codeType, value, 5),
    enabled: !!orgSlug && !!value,
    staleTime: 600_000,
  });

  // Options for the open dropdown — debounced server-side search (name OR code).
  const effectiveQuery = query || (search ?? '').trim();
  const options = useQuery({
    queryKey: ['etims-codes', 'search', orgSlug, codeType, effectiveQuery],
    queryFn: () => etimsApi.codeLists(orgSlug, codeType, effectiveQuery || undefined, 50),
    enabled: !!orgSlug && open,
    placeholderData: keepPreviousData,
    staleTime: 120_000,
  });

  const list: EtimsCode[] = options.data ?? [];

  const selectedName = useMemo(() => {
    const hit =
      list.find((c) => c.code === value) ?? (resolved.data ?? []).find((c) => c.code === value);
    return hit?.name;
  }, [list, resolved.data, value]);

  // Reset the active row whenever the visible list changes.
  useEffect(() => {
    setActiveIndex(0);
  }, [effectiveQuery, open]);

  function pick(code: string) {
    onChange(code);
    setOpen(false);
    setRawSearch('');
    setQuery('');
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = list[activeIndex];
      if (hit) pick(hit.code);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }

  // Keep the active row scrolled into view during keyboard nav.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Fallback: tenant hasn't synced this code list yet → free-text entry so the field is
  // never a dead end. Preserves the original hint + uppercase behaviour.
  if (probe.isSuccess && (probe.data?.length ?? 0) === 0) {
    return (
      <div className={className}>
        <input
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={placeholder}
        />
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Sync KRA code lists in Treasury (eTIMS Devices → Refresh Code Lists) to pick from the full list.
        </p>
      </div>
    );
  }

  const triggerLabel = value
    ? selectedName
      ? `${selectedName} (${value})`
      : value
    : (placeholder ?? 'None (use defaults)');

  return (
    <div className={`relative ${className ?? ''}`} ref={rootRef}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`${inputCls} flex items-center justify-between gap-2 text-left`}
        >
          <span className={`truncate ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
            {triggerLabel}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        {value && (
          <button
            type="button"
            aria-label="Clear selection"
            title="Clear"
            onClick={() => onChange('')}
            className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-input text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                autoFocus
                value={rawSearch}
                onChange={(e) => setRawSearch(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search by name or code…"
                className="w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
              />
            </div>
          </div>

          <div ref={listRef} className="max-h-60 overflow-y-auto py-1">
            {value && (
              <button
                type="button"
                onClick={() => pick('')}
                className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:bg-accent"
              >
                Clear selection (use defaults)
              </button>
            )}

            {options.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching…
              </div>
            ) : options.isError ? (
              <div className="py-6 text-center text-sm text-destructive">Couldn&apos;t load codes</div>
            ) : list.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No matches{effectiveQuery ? ` for “${effectiveQuery}”` : ''}
              </div>
            ) : (
              list.map((c, idx) => (
                <button
                  key={`${c.code_type}:${c.code}`}
                  type="button"
                  data-idx={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => pick(c.code)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors ${
                    idx === activeIndex ? 'bg-accent' : 'hover:bg-accent'
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{c.name}</span>
                    <span className="block truncate font-mono text-xs text-muted-foreground">{c.code}</span>
                  </span>
                  {c.code === value && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
