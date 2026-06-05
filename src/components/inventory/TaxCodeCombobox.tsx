'use client';

import { Input } from '@/components/ui/base';
import { useTaxes } from '@/hooks/useTaxes';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  orgSlug:      string;
  value:        string;                 // selected tax code (e.g. "VAT-16")
  onChange:     (code: string) => void;
  disabled?:    boolean;
  placeholder?: string;
  className?:   string;
}

/**
 * Searchable tax-code picker. Options are sourced + cached from treasury-api (the platform
 * source of truth) via inventory-api's GET /inventory/taxes. Emits the selected tax `code`.
 * Falls back to letting the user type a custom code when treasury is unavailable or the
 * desired code isn't in the synced list, so the field is never a dead end.
 */
export function TaxCodeCombobox({ orgSlug, value, onChange, disabled, placeholder = 'Select a tax code…', className }: Props) {
  const { data: taxes } = useTaxes(orgSlug);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const list = taxes ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (t) => t.code.toLowerCase().includes(q) || t.name.toLowerCase().includes(q),
    );
  }, [taxes, query]);

  const selected = useMemo(
    () => (taxes ?? []).find((t) => t.code.toLowerCase() === value.toLowerCase()),
    [taxes, value],
  );

  const trimmedQuery = query.trim().toUpperCase();
  const exactMatch = (taxes ?? []).some((t) => t.code.toUpperCase() === trimmedQuery);

  function select(code: string) {
    onChange(code);
    setOpen(false);
    setQuery('');
  }

  return (
    <div className={`relative ${className ?? ''}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <span className={`truncate ${value ? 'text-foreground' : 'text-muted-foreground'}`}>
          {value
            ? <span className="font-mono">{value}{selected ? <span className="font-sans text-muted-foreground"> · {selected.name}</span> : null}</span>
            : placeholder}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-xl">
          <div className="relative border-b border-border p-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search tax codes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-9"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {value && (
              <button
                type="button"
                onClick={() => select('')}
                className="w-full px-4 py-2 text-left text-xs text-muted-foreground hover:bg-accent"
              >
                Clear selection
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-muted-foreground">
                {(taxes ?? []).length === 0
                  ? 'No tax codes synced from treasury yet.'
                  : 'No matching tax codes.'}
              </div>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  onClick={() => select(t.code)}
                  className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-accent"
                >
                  <span className="truncate">
                    <span className="font-mono">{t.code}</span>
                    <span className="text-muted-foreground"> · {t.name}</span>
                    {t.is_default ? <span className="ml-1 text-[10px] uppercase text-primary">default</span> : null}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{t.rate}%</span>
                    {value.toLowerCase() === t.code.toLowerCase() && <Check className="h-4 w-4 text-primary" />}
                  </span>
                </button>
              ))
            )}
            {/* Custom-code fallback: type a code treasury hasn't synced (graceful degradation). */}
            {trimmedQuery && !exactMatch && (
              <button
                type="button"
                onClick={() => select(trimmedQuery)}
                className="flex w-full items-center gap-1.5 border-t border-border px-4 py-2.5 text-sm text-primary hover:bg-accent"
              >
                Use <span className="font-mono">&quot;{trimmedQuery}&quot;</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
