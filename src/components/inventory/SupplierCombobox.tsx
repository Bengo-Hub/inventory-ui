'use client';

import { suppliersApi, type Supplier } from '@/lib/api/suppliers';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Check, ChevronDown, Loader2, Plus, Search, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const PAGE_SIZE = 20;

interface Props {
  orgSlug: string;
  /** Selected supplier id (uuid) or '' when none. */
  value: string;
  onChange: (id: string) => void;
  /** Display name for the current value when its row isn't in the loaded pages (edit mode). */
  valueLabel?: string;
  placeholder?: string;
  /** Opens the "+ Add new vendor" dialog (owned by the parent, like CreatableSelect). */
  onAddNew?: () => void;
  disabled?: boolean;
}

const inputCls =
  'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';

// Searchable, paginated supplier picker backed by GET /inventory/suppliers (debounced search +
// load-more pagination). A sticky "+ Add new vendor" footer opens the parent-owned create dialog.
// Bound to preferred_supplier_id on the item form.
export function SupplierCombobox({
  orgSlug,
  value,
  onChange,
  valueLabel,
  placeholder = 'Select a preferred supplier...',
  onAddNew,
  disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const [rawSearch, setRawSearch] = useState('');
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  // Debounce the search term (300ms) so each keystroke doesn't hit the API.
  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch.trim()), 300);
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

  const query = useInfiniteQuery({
    queryKey: ['suppliers', 'combobox', orgSlug, search],
    queryFn: ({ pageParam = 1 }) =>
      suppliersApi.list(orgSlug, { search: search || undefined, page: pageParam, limit: PAGE_SIZE }),
    enabled: !!orgSlug && open,
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) =>
      lastPage.hasMore ? pages.length + 1 : undefined,
    staleTime: 30_000,
  });

  const suppliers: Supplier[] = useMemo(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data],
  );

  const selected = suppliers.find((s) => s.id === value);
  const buttonLabel = value
    ? selected?.name ?? valueLabel ?? 'Selected supplier'
    : placeholder;

  function pick(s: Supplier) {
    onChange(s.id);
    setOpen(false);
  }

  return (
    <div className="relative" ref={rootRef}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={`${inputCls} flex items-center justify-between text-left disabled:opacity-50`}
        >
          <span className={value ? '' : 'text-muted-foreground'}>{buttonLabel}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
        {value && !disabled && (
          <button
            type="button"
            aria-label="Clear preferred supplier"
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
                placeholder="Search suppliers by name..."
                className="w-full rounded-md border border-input bg-transparent pl-8 pr-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto">
            {query.isLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading suppliers...
              </div>
            ) : query.isError ? (
              <div className="py-6 text-center text-sm text-destructive">Couldn&apos;t load suppliers</div>
            ) : suppliers.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No suppliers found{search ? ` for “${search}”` : ''}
              </div>
            ) : (
              suppliers.map((s) => {
                const secondary = s.contact_person || s.phone || s.email;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => pick(s)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{s.name}</span>
                      {secondary && (
                        <span className="block text-xs text-muted-foreground truncate">{secondary}</span>
                      )}
                    </span>
                    {s.id === value && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </button>
                );
              })
            )}

            {query.hasNextPage && (
              <button
                type="button"
                onClick={() => query.fetchNextPage()}
                disabled={query.isFetchingNextPage}
                className="w-full px-3 py-2 text-xs font-medium text-primary hover:bg-accent disabled:opacity-50"
              >
                {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
              </button>
            )}
          </div>

          {onAddNew && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onAddNew();
              }}
              className="sticky bottom-0 w-full flex items-center gap-2 border-t border-border bg-popover px-3 py-2.5 text-sm font-medium text-primary hover:bg-accent transition-colors"
            >
              <Plus className="h-4 w-4" /> Add new vendor
            </button>
          )}
        </div>
      )}
    </div>
  );
}
