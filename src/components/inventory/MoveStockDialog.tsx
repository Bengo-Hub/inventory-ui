'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useStock, useRelocateItemLocation } from '@/hooks/useStock';
import { ActiveWarehousePicker } from '@/components/inventory/ActiveWarehousePicker';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { apiErrorMessage } from '@/lib/api/error-message';
import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export interface MoveStockItem {
  itemId: string;
  name: string;
  sku: string;
}

interface MoveStockDialogProps {
  orgSlug: string;
  /** One entry = single-item move; many = batch move (one shared source→destination pair). */
  items: MoveStockItem[];
  onClose: () => void;
  /** Called after the move completes so callers can refetch. */
  onDone?: () => void;
}

/**
 * MoveStockDialog — the "add to location" / "remove from location" quick action: relocates one
 * or many items' ENTIRE current balance — whatever it is right now, including zero — from one
 * outlet/warehouse to another in a single submit.
 *
 * NOT a stock transfer: a transfer moves a chosen quantity between two balances that both
 * continue to exist, and requires the source to have enough available to ship. A relocation has
 * no chosen quantity — it carries the item's whole presence at the source to the destination and
 * unlinks it from the source outright (InventoryBalance.removed_from_location), so it stops
 * appearing there at all rather than lingering as a zero row. This is why an item sitting at 0
 * stock can still be moved: there's nothing to be "insufficient" for. See
 * stock.RelocateItemLocation's doc comment (backend) for the full design.
 */
export function MoveStockDialog({ orgSlug, items, onClose, onDone }: MoveStockDialogProps) {
  const source = useActiveWarehouse(orgSlug);
  const { data: warehouses } = useWarehouses(orgSlug);
  const [destWarehouseId, setDestWarehouseId] = useState('');
  const [notes, setNotes] = useState('');

  // Informational only — shows what's currently at the source per item so the user knows what
  // they're about to relocate. Refetches whenever "From" changes.
  const { data: sourceStock = [] } = useStock(orgSlug, { warehouse_id: source.warehouseId || undefined });
  const availableBySku = new Map(sourceStock.map((s) => [s.sku, s.available]));

  const relocate = useRelocateItemLocation(orgSlug);
  const isBusy = relocate.isPending;

  const destOptions = (warehouses ?? []).filter((w) => w.id !== source.warehouseId);
  const isBatch = items.length > 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (source.unresolved) {
      toast.error('Select the source warehouse before submitting');
      return;
    }
    if (!source.warehouseId || !destWarehouseId) {
      toast.error('Select both the source and destination');
      return;
    }
    if (source.warehouseId === destWarehouseId) {
      toast.error('Source and destination must be different');
      return;
    }

    try {
      const result = await relocate.mutateAsync({
        item_ids: items.map((i) => i.itemId),
        source_warehouse_id: source.warehouseId,
        destination_warehouse_id: destWarehouseId,
        notes: notes.trim() || undefined,
      });
      const destName = destOptions.find((w) => w.id === destWarehouseId)?.name ?? 'the destination';
      if (result.processed > 0) {
        toast.success(
          result.processed === 1
            ? `Moved ${items.find((i) => !result.skipped.some((s) => s.item_id === i.itemId))?.name ?? 'item'} to ${destName}`
            : `Moved ${result.processed} item${result.processed === 1 ? '' : 's'} to ${destName}`,
        );
      }
      if (result.skipped.length > 0) {
        const names = result.skipped
          .map((s) => items.find((i) => i.itemId === s.item_id)?.name ?? s.item_id)
          .join(', ');
        toast.warning(
          result.processed > 0
            ? `Skipped ${result.skipped.length}: ${names} (not present at the source)`
            : `Nothing moved — none of the selected items are present at ${source.allWarehouses.find((w) => w.id === source.warehouseId)?.name ?? 'the source'}`,
        );
      }
      onDone?.();
      onClose();
    } catch (err) {
      toast.error(await apiErrorMessage(err, 'Failed to move stock'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] flex flex-col">
        <Card className="flex flex-col overflow-hidden max-h-[90vh]">
          <CardHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{isBatch ? `Move ${items.length} items` : 'Move stock'}</h2>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Moves each item&apos;s entire current stock to the destination — whatever it is right
              now, even zero — and unlinks it from the source outlet entirely.
            </p>
          </CardHeader>
          <CardContent className="overflow-y-auto flex-1">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ActiveWarehousePicker active={source} label="From" required />
                <div className="space-y-2">
                  <label className="text-sm font-medium">To *</label>
                  <CreatableSelect
                    value={destWarehouseId}
                    onChange={setDestWarehouseId}
                    options={destOptions.map((w) => ({ id: w.id, name: w.name }))}
                    placeholder="Select destination…"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Items to move</p>
                {items.map((item) => {
                  const avail = availableBySku.get(item.sku);
                  return (
                    <div key={item.itemId} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                      </div>
                      <p className={`text-[11px] shrink-0 ${avail === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {avail != null ? `${avail.toLocaleString()} here` : source.warehouseId ? 'Not stocked here' : 'Select a source'}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Note</label>
                <Input
                  placeholder="Optional note for this move..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isBusy}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isBusy}>
                  {isBusy ? 'Moving...' : 'Move stock'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
