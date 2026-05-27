'use client';

import { Input } from '@/components/ui/base';
import { apiClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface ItemResult {
  id: string;
  sku: string;
  name: string;
  available?: number;
}

interface Props {
  orgSlug: string;
  value: string;
  onSelect: (item: ItemResult) => void;
  placeholder?: string;
  label?: string;
  /** Use fixed positioning for the dropdown so it escapes overflow:auto parents (e.g. modals) */
  fixedDropdown?: boolean;
}

export function ItemSearchInput({ orgSlug, value, onSelect, placeholder = 'Search items...', label, fixedDropdown }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const { data: results } = useQuery<ItemResult[]>({
    queryKey: ['item-search', orgSlug, query],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ItemResult[]; total: number } | ItemResult[]>(
        `/api/v1/${orgSlug}/inventory/items`,
        { search: query }
      );
      return Array.isArray(res) ? res : (res as { data: ItemResult[] }).data ?? [];
    },
    enabled: !!orgSlug && query.length >= 2,
    placeholderData: [],
    staleTime: 30_000,
  });

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useLayoutEffect(() => {
    if (!fixedDropdown || !open || !inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    });
  }, [open, fixedDropdown, query]);

  function handleSelect(item: ItemResult) {
    onSelect(item);
    setQuery('');
    setOpen(false);
  }

  const dropdownVisible = open && (results?.length ?? 0) > 0;

  return (
    <div className="space-y-2" ref={ref}>
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="relative" ref={inputRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={placeholder}
          value={query || value}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          className="pl-10"
        />
        {dropdownVisible && !fixedDropdown && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-52 overflow-y-auto">
            {results?.slice(0, 10).map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
                onMouseDown={() => handleSelect(item)}
              >
                <span className="font-medium">{item.name}</span>
                <span className="ml-2 text-xs text-muted-foreground font-mono">{item.sku}</span>
                {item.available !== undefined && (
                  <span className="ml-auto float-right text-xs text-muted-foreground">Avail: {item.available}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {dropdownVisible && fixedDropdown && (
        <div
          style={dropdownStyle}
          className="rounded-lg border border-border bg-popover shadow-xl max-h-52 overflow-y-auto"
        >
          {results?.slice(0, 10).map((item) => (
            <button
              key={item.id}
              type="button"
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors first:rounded-t-lg last:rounded-b-lg"
              onMouseDown={() => handleSelect(item)}
            >
              <span className="font-medium">{item.name}</span>
              <span className="ml-2 text-xs text-muted-foreground font-mono">{item.sku}</span>
              {item.available !== undefined && (
                <span className="ml-auto float-right text-xs text-muted-foreground">Avail: {item.available}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
