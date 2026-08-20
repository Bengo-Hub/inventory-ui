'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
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

/** Mutually exclusive outlet-removal modes — see MoveStockDialog's doc comment. */
type RemovalMode = 'hide' | 'move' | 'zero';

/**
 * MoveStockDialog — the catalog item-movement dialog: check the outlets an item should be
 * stocked in, uncheck the ones it shouldn't. Single-item mode pre-checks the item's current
 * outlets (fetched live); bulk mode starts every checkbox unchecked and applies whatever you
 * check to every selected item uniformly, since a heterogeneous batch has no single "current"
 * state to pre-fill.
 *
 * NOT a stock transfer: there's no source/destination pair and no chosen quantity. What happens
 * to an UNCHECKED outlet's stock depends on the removal mode chosen below:
 *   - Hide (default): the outlet's balance is untouched — only its removed_from_location flag
 *     flips, so the item stops appearing there. Re-checking it later brings it back with the
 *     exact quantity it had when hidden. Never moves or clears real stock.
 *   - Move stock: carries the unchecked outlets' quantity to whichever outlet(s) you're
 *     checking — requires at least one new destination, since otherwise there's nowhere for it
 *     to go.
 *   - Move with zero stock: an explicit write-off — dropped outlets' stock is discarded and
 *     newly-checked outlets start at zero. Confirmed before it's sent.
 * See stock.SetItemOutletMembership's doc comment (backend) for the full per-item design.
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
  const [removalMode, setRemovalMode] = useState<RemovalMode>('hide');
  const [moveQuantity, setMoveQuantity] = useState('');
  const [confirmingZeroStock, setConfirmingZeroStock] = useState(false);
  const zeroStockMode = removalMode === 'zero';
  const moveWithStock = removalMode === 'move';

  const isBatch = items.length > 1;

  // Single-item mode: pre-check the item's CURRENT active warehouses (useStock already excludes
  // removed_from_location=true balances, so every row it returns is a genuine active presence).
  // Bulk mode intentionally skips this — a heterogeneous selection has no single "current" set.
  const { data: currentStock = [] } = useStock(orgSlug, { item_id: items[0]?.itemId }, !isBatch);
  useEffect(() => {
    if (isBatch || touched) return;
    setChecked(new Set(currentStock.map((s) => s.warehouse_id)));
  }, [isBatch, touched, currentStock]);

  // A clean 1-dropped+1-added pair (single-item mode only — bulk has no per-item "current" set
  // to diff against) is the one shape a chosen quantity means anything for: move exactly this
  // much, leave the remainder at the source, instead of carrying everything to the destination.
  const originalIds = useMemo(() => new Set(currentStock.map((s) => s.warehouse_id)), [currentStock]);
  const droppedIds = useMemo(
    () => (isBatch ? [] : Array.from(originalIds).filter((id) => !checked.has(id))),
    [isBatch, originalIds, checked],
  );
  const addedIds = useMemo(
    () => (isBatch ? [] : Array.from(checked).filter((id) => !originalIds.has(id))),
    [isBatch, checked],
  );
  const isPartialPairEligible = moveWithStock && droppedIds.length === 1 && addedIds.length === 1;
  const sourceStock = isPartialPairEligible ? currentStock.find((s) => s.warehouse_id === droppedIds[0]) : undefined;
  const sourceOnHand = sourceStock?.on_hand ?? 0;

  // "Move stock" needs somewhere to land — single-item mode can check this exactly (a newly
  // checked outlet); bulk mode has no per-item "current" set to diff against client-side, so it
  // falls back to the same coarse check the API enforces (at least one outlet checked at all).
  const hasMoveDestination = isBatch ? checked.size > 0 : addedIds.length > 0;

  useEffect(() => {
    // Reset any stale quantity the moment the pair shape changes (a different pair, or no
    // longer a pair at all) so a leftover value can't silently apply to an unrelated move.
    setMoveQuantity('');
  }, [droppedIds[0], addedIds[0]]);

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

  async function doSubmit() {
    const qty = isPartialPairEligible ? Number(moveQuantity) : NaN;
    try {
      const job = await setMembership.mutateAsync({
        item_ids: items.map((i) => i.itemId),
        target_warehouse_ids: Array.from(checked),
        notes: notes.trim() || undefined,
        move_quantity: Number.isFinite(qty) && qty > 0 ? qty : undefined,
        zero_stock_mode: zeroStockMode || undefined,
        move_with_stock: moveWithStock || undefined,
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
    } finally {
      setConfirmingZeroStock(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (moveWithStock && !hasMoveDestination) {
      toast.error('Check at least one outlet to move the stock into.');
      return;
    }
    // Zero-stock mode discards real on-hand rather than carrying it anywhere — confirm with an
    // explicit warning before it ever reaches the API, same as any other destructive action.
    if (zeroStockMode) {
      setConfirmingZeroStock(true);
      return;
    }
    void doSubmit();
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
                ? 'Check the outlets these items should be stocked in; unchecked outlets are hidden (not cleared) for every item selected.'
                : 'Check the outlets this item should be stocked in; unchecking hides it there — its stock stays put unless you choose to move it below.'}
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

              {isPartialPairEligible && (
                <div className="space-y-2 rounded-lg border border-border p-3">
                  <label className="text-sm font-medium">Quantity to move</label>
                  <Input
                    type="number"
                    min={0}
                    max={sourceOnHand}
                    step="any"
                    placeholder={`All (${sourceOnHand}) — leave blank to move everything`}
                    value={moveQuantity}
                    onChange={(e) => setMoveQuantity(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {moveQuantity && Number(moveQuantity) < sourceOnHand
                      ? `Moves ${moveQuantity} of ${sourceOnHand} — the remaining ${sourceOnHand - Number(moveQuantity)} stays (hidden) at the current outlet.`
                      : `Moving all ${sourceOnHand} — the current outlet will be hidden, not cleared; it keeps nothing after the move.`}
                  </p>
                </div>
              )}

              <div className="space-y-1.5 rounded-lg border border-border p-1">
                <label className="flex items-start gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-accent/50">
                  <input
                    type="radio"
                    name="removal-mode"
                    checked={removalMode === 'hide'}
                    onChange={() => setRemovalMode('hide')}
                    className="h-4 w-4 mt-0.5"
                  />
                  <span className="text-sm">
                    <span className="font-medium">Hide (keep stock)</span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      Unchecked outlets stop showing this item but keep their current stock.
                      Re-check the outlet later and it reappears with the same quantity.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-accent/50">
                  <input
                    type="radio"
                    name="removal-mode"
                    checked={removalMode === 'move'}
                    onChange={() => setRemovalMode('move')}
                    className="h-4 w-4 mt-0.5"
                  />
                  <span className="text-sm">
                    <span className="font-medium">Move stock to the outlet(s) I'm adding</span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      Carries the unchecked outlets' stock into whichever outlet(s) you check.
                      Needs at least one new outlet checked — otherwise there's nowhere for it to go.
                    </span>
                    {removalMode === 'move' && !hasMoveDestination && (
                      <span className="block text-[11px] text-destructive mt-1">
                        Check a destination outlet to move stock into.
                      </span>
                    )}
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-lg px-2 py-2 cursor-pointer hover:bg-accent/50">
                  <input
                    type="radio"
                    name="removal-mode"
                    checked={removalMode === 'zero'}
                    onChange={() => setRemovalMode('zero')}
                    className="h-4 w-4 mt-0.5"
                  />
                  <span className="text-sm">
                    <span className="font-medium">Move with zero stock</span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5">
                      Drop the current stock instead of carrying it over — unchecked outlets lose their
                      stock entirely, and newly-checked outlets start at zero.
                    </span>
                  </span>
                </label>
              </div>

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
                <Button type="submit" className="flex-1" disabled={isBusy || (moveWithStock && !hasMoveDestination)}>
                  {isBusy ? 'Queuing...' : 'Apply'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={confirmingZeroStock}
        title="Move with zero stock?"
        description={
          isBatch
            ? `This drops the current stock of every unchecked outlet for all ${items.length} selected items — that stock is discarded, not moved. Newly-checked outlets start at zero. This cannot be undone.`
            : `This drops ${items[0]?.name ?? 'this item'}'s current stock at every unchecked outlet — that stock is discarded, not moved. Newly-checked outlets start at zero. This cannot be undone.`
        }
        variant="warning"
        confirmLabel={isBusy ? 'Applying...' : 'Move with zero stock'}
        onConfirm={() => void doSubmit()}
        onCancel={() => setConfirmingZeroStock(false)}
      />
    </div>
  );
}
