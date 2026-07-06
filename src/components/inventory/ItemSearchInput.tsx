'use client';

import { Input } from '@/components/ui/base';
import { apiClient } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/api/error-message';
import { ItemFormDialog } from '@/components/inventory/ItemFormDialog';
import { BarcodeScanButton } from '@/components/inventory/BarcodeScanner';
import { useCreateItem } from '@/hooks/useItems';
import type { CreateItemInput, Item } from '@/lib/api/items';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface ItemResult {
  id: string;
  sku: string;
  name: string;
  available?: number;
  cost_price?: number | null;
  suggested_price?: number | null;
  unit_id?: string;
  type?: string;
  // Purchase pack fields — how the item is actually bought (e.g. 52.50 per 500 ml
  // packet). Used to prefill a recipe line's cost basis so a pack price is never
  // mistaken for a per-base-unit cost. purchase_pack_size is in base units per pack.
  purchase_price?: number | null;
  purchase_pack_size?: number | null;
  purchase_unit?: string;
  yield_pct?: number | null;
  // Content-per-unit bridge (750 ml per bottle piece) — lets ml/g recipe lines
  // cost + deduct fractional stock units of count-stocked packaged goods.
  unit_content_qty?: number | null;
  unit_content_uom?: string | null;
}

interface Props {
  orgSlug: string;
  value: string;
  onSelect: (item: ItemResult) => void;
  placeholder?: string;
  label?: string;
  /** Use fixed positioning for the dropdown so it escapes overflow:auto parents (e.g. modals) */
  fixedDropdown?: boolean;
  /** Allow creating a new item inline when no match is found (default: true). */
  allowCreate?: boolean;
  /** Show the camera barcode-scan button (default: true). Scanning fills the search query. */
  enableScan?: boolean;
}

function itemToResult(i: Item): ItemResult {
  return {
    id: i.id,
    sku: i.sku,
    name: i.name,
    cost_price: i.cost_price ?? null,
    suggested_price: i.suggested_price ?? null,
    unit_id: i.unit_id ?? undefined,
    type: i.type,
    purchase_price: i.purchase_price ?? null,
    purchase_pack_size: i.purchase_pack_size ?? null,
    purchase_unit: i.purchase_unit,
    yield_pct: i.yield_pct ?? null,
    unit_content_qty: i.unit_content_qty ?? null,
    unit_content_uom: i.unit_content_uom ?? null,
  };
}

export function ItemSearchInput({ orgSlug, value, onSelect, placeholder = 'Search items...', label, fixedDropdown, allowCreate = true, enableScan = true }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const [createOpen, setCreateOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const createItem = useCreateItem(orgSlug);

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

  function handleCreateSubmit(data: CreateItemInput) {
    createItem.mutate(data, {
      onSuccess: (created) => {
        toast.success('Item created');
        setCreateOpen(false);
        handleSelect(itemToResult(created));
      },
      onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create item')),
    });
  }

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

  const trimmed = query.trim();
  const exactMatch = (results ?? []).some((r) => r.name.toLowerCase() === trimmed.toLowerCase());
  const showCreate = allowCreate && trimmed.length >= 2 && !exactMatch;
  const dropdownVisible = open && ((results?.length ?? 0) > 0 || showCreate);

  const createButton = showCreate ? (
    <button
      type="button"
      className="flex w-full items-center gap-1.5 border-t border-border px-4 py-2.5 text-sm text-primary hover:bg-accent"
      onMouseDown={(e) => { e.preventDefault(); setOpen(false); setCreateOpen(true); }}
    >
      <Plus className="h-4 w-4" />
      Create &quot;{trimmed}&quot;
    </button>
  ) : null;

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
          className={enableScan ? 'pl-10 pr-12' : 'pl-10'}
        />
        {enableScan && (
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <BarcodeScanButton
              title="Scan item barcode"
              hint="Point the camera at the item barcode."
              className="h-8 w-8 rounded-lg"
              onScan={(code) => { setQuery(code); setOpen(true); }}
            />
          </div>
        )}
        {dropdownVisible && !fixedDropdown && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-52 overflow-y-auto">
            {results?.slice(0, 10).map((item) => (
              <button
                key={item.id}
                type="button"
                className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors first:rounded-t-lg"
                onMouseDown={() => handleSelect(item)}
              >
                <span className="font-medium">{item.name}</span>
                <span className="ml-2 text-xs text-muted-foreground font-mono">{item.sku}</span>
                {item.available !== undefined && (
                  <span className="ml-auto float-right text-xs text-muted-foreground">Avail: {item.available}</span>
                )}
              </button>
            ))}
            {createButton}
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
              className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors first:rounded-t-lg"
              onMouseDown={() => handleSelect(item)}
            >
              <span className="font-medium">{item.name}</span>
              <span className="ml-2 text-xs text-muted-foreground font-mono">{item.sku}</span>
              {item.available !== undefined && (
                <span className="ml-auto float-right text-xs text-muted-foreground">Avail: {item.available}</span>
              )}
            </button>
          ))}
          {createButton}
        </div>
      )}

      {createOpen && (
        <ItemFormDialog
          orgSlug={orgSlug}
          initialName={trimmed}
          onClose={() => setCreateOpen(false)}
          onSubmit={handleCreateSubmit}
          isPending={createItem.isPending}
        />
      )}
    </div>
  );
}
