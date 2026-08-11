'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useStock, useSetItemOutletMembership } from '@/hooks/useStock';
import { apiErrorMessage } from '@/lib/api/error-message';
import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

export interface MoveStockItem {
  itemId: string;
  name: string;
  sku: string;
}

interface MoveStockDialogProps {
  orgSlug: string;
  /** One entry = single-item; many = bulk (the checked outlet set applies uniformly to all). */
  items: MoveStockItem[];
  onClose: () => void;
  /** Called once the job is QUEUED (not once it finishes — bulk jobs run in the background;
   *  see org-shell's bulk_job.completed notification for the real completion signal). */
  onDone?: () => void;
}

/**
 * MoveStockDialog — the catalog item-movement dialog: check the outlets an item should be
 * stocked in, uncheck the ones it shouldn't. Single-item mode pre-checks the item's current
 * outlets (fetched live); bulk mode starts every checkbox unchecked and applies whatever you
 * check to every selected item uniformly, since a heterogeneous batch has no single "current"
 * state to pre-fill.
 *
 * NOT a stock transfer: there's no source/destination pair and no chosen quantity. Checking an
 * outlet adds an active balance there; unchecking marks the outlet's balance
 * removed_from_location so the item stops appearing there entirely (never lingers as a zero
 * row). Quantity pulled from unchecked outlets is pooled and split across newly-checked ones —
 * see stock.SetItemOutletMembership's doc comment (backend) for the full design.
 *
 * Runs as a background job (queues instantly, processes off the request) — this dialog closes
 * the moment the job is accepted; a toast reports the real per-item result once it completes
 * (org-shell's notification listener), with the Stock/Products lists refreshing to match.
 */
export function MoveStockDialog({ orgSlug, items, onClose, onDone }: MoveStockDialogProps) {
  const { data: warehouses = [] } = useWarehouses(orgSlug);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [touched, setTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [search, setSearch] = useState('');

  const isBatch = items.length > 1;

  // Single-item mode: pre-check the item's CURRENT active warehouses (useStock already excludes
  // removed_from_location=true balances, so every row it returns is a genuine active presence).
  // Bulk mode intentionally skips this — a heterogeneous selection has no single "current" set.
  const { data: currentStock = [] } = useStock(orgSlug, { item_id: items[0]?.itemId }, !isBatch);
  useEffect(() => {
    if (isBatch || touched) return;
    setChecked(new Set(currentStock.map((s) => s.warehouse_id)));
  }, [isBatch, touched, currentStock]);

  const setMembership = useSetItemOutletMembership(orgSlug);
  const isBusy = setMembership.isPending;

  const filteredWarehouses = useMemo(() => {
    if (!search) return warehouses;
    const q = search.toLowerCase();
    return warehouses.filter((w) => w.name.toLowerCase().includes(q) || w.code.toLowerCase().includes(q));
  }, [warehouses, search]);

  function toggle(id: string) {
    setTouched(true);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const job = await setMembership.mutateAsync({
        item_ids: items.map((i) => i.itemId),
        target_warehouse_ids: Array.from(checked),
        notes: notes.trim() || undefined,
      });
      toast.info(
        isBatch
          ? `Updating outlets for ${items.length} items in the background — you'll be notified when it's done.`
          : `Updating outlets for ${items[0]?.name ?? 'item'} in the background...`,
        { description: `Job ${job.job_id.slice(0, 8)}…`, duration: 5000 },
      );
      onDone?.();
      onClose();
    } catch (err) {
      toast.error(await apiErrorMessage(err, 'Failed to queue the outlet change'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] flex flex-col">
        <Card className="flex flex-col overflow-hidden max-h-[90vh]">
          <CardHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {isBatch ? `Set outlets for ${items.length} items` : `Set outlets — ${items[0]?.name ?? ''}`}
              </h2>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isBatch
                ? 'Check the outlets these items should be stocked in; unchecked outlets are removed for every item selected.'
                : 'Check the outlets this item should be stocked in; unchecking removes it from that outlet entirely.'}
            </p>
          </CardHeader>
          <CardContent className="overflow-y-auto flex-1">
            <form onSubmit={handleSubmit} className="space-y-4">
              {warehouses.length > 6 && (
                <Input
                  placeholder="Search outlets…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              )}

              <div className="space-y-1 max-h-72 overflow-y-auto rounded-lg border border-border">
                {filteredWarehouses.map((w) => {
                  const isChecked = checked.has(w.id);
                  return (
                    <label
                      key={w.id}
                      className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent/50 cursor-pointer border-b border-border last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(w.id)}
                        className="h-4 w-4 rounded border-input"
                      />
                      <span className="flex-1 min-w-0 truncate">{w.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground shrink-0">{w.code}</span>
                    </label>
                  );
                })}
                {filteredWarehouses.length === 0 && (
                  <p className="px-3 py-4 text-xs text-muted-foreground text-center">No outlets found</p>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground">{checked.size} outlet{checked.size === 1 ? '' : 's'} selected</p>

              <div className="space-y-2">
                <label className="text-sm font-medium">Note</label>
                <Input
                  placeholder="Optional note for this change..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isBusy}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isBusy}>
                  {isBusy ? 'Queuing...' : 'Apply'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
