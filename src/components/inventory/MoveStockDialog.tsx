'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useCreateTransfer, useShipTransfer, useReceiveTransfer } from '@/hooks/useTransfers';
import { ActiveWarehousePicker } from '@/components/inventory/ActiveWarehousePicker';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { apiErrorMessage } from '@/lib/api/error-message';
import { approvalGateFromError } from '@/lib/api/approvals';
import { parseDecimal, DECIMAL_STEP } from '@/lib/utils';
import { X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export interface MoveStockItem {
  itemId: string;
  name: string;
  sku: string;
  /** Available qty at the currently-resolved source warehouse, if known — prefills the qty input. */
  availableQty?: number;
}

interface MoveStockDialogProps {
  orgSlug: string;
  /** One entry = single-item move; many = batch move (one shared source→destination pair). */
  items: MoveStockItem[];
  onClose: () => void;
  /** Called after the move completes (fully, or submitted for approval) so callers can refetch. */
  onDone?: () => void;
}

/**
 * MoveStockDialog — the "add to location" / "remove from location" quick action: moves one or
 * many items from one outlet/warehouse to another in a single submit. Under the hood this is
 * the existing StockTransfer document flow (create → ship → receive), chained automatically so
 * the user doesn't have to visit the Transfers page and click Ship then Receive separately — the
 * atomic balance move (and the real-time POS/ordering/catalog sync it triggers) is 100% the
 * existing transfer machinery, not reimplemented here. If a stock_transfer approval rule gates
 * shipping, the chain stops after create and the transfer sits as a normal pending approval,
 * actionable from the Transfers page like any other.
 */
export function MoveStockDialog({ orgSlug, items, onClose, onDone }: MoveStockDialogProps) {
  const source = useActiveWarehouse(orgSlug);
  const { data: warehouses } = useWarehouses(orgSlug);
  const [destWarehouseId, setDestWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [quantities, setQuantities] = useState<Record<string, string>>(
    () => Object.fromEntries(items.map((i) => [i.itemId, i.availableQty != null ? String(i.availableQty) : ''])),
  );

  const createTransfer = useCreateTransfer(orgSlug);
  const shipTransfer = useShipTransfer(orgSlug);
  const receiveTransfer = useReceiveTransfer(orgSlug);
  const isBusy = createTransfer.isPending || shipTransfer.isPending || receiveTransfer.isPending;

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
    const lines = items
      .map((i) => ({ item_id: i.itemId, quantity: parseDecimal(quantities[i.itemId] ?? '') }))
      .filter((l) => l.quantity > 0);
    if (lines.length === 0) {
      toast.error('Enter a quantity greater than zero for at least one item');
      return;
    }

    try {
      const transfer = await createTransfer.mutateAsync({
        source_warehouse_id: source.warehouseId,
        destination_warehouse_id: destWarehouseId,
        notes: notes.trim() || undefined,
        items: lines,
      });

      try {
        await shipTransfer.mutateAsync(transfer.id);
      } catch (shipErr) {
        const gate = approvalGateFromError(shipErr);
        if (gate) {
          toast.info('Move submitted for approval — it will complete once approved.', {
            description: 'Find it on the Transfers page to track its status.',
            duration: 6000,
          });
          onDone?.();
          onClose();
          return;
        }
        toast.error(await apiErrorMessage(shipErr, 'The move was created but could not ship'), {
          description: 'Open the Transfers page to retry shipping it.',
        });
        onDone?.();
        onClose();
        return;
      }

      await receiveTransfer.mutateAsync({ id: transfer.id });
      const destName = destOptions.find((w) => w.id === destWarehouseId)?.name ?? 'the destination';
      toast.success(
        lines.length === 1
          ? `Moved ${items[0]?.name ?? 'item'} to ${destName}`
          : `Moved ${lines.length} items to ${destName}`,
      );
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
              Ships from the source and receives at the destination in one step — the item stops
              showing as available at the source the moment this completes.
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
                {items.map((item) => (
                  <div key={item.itemId} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                    </div>
                    <div className="w-28 shrink-0 space-y-1">
                      <Input
                        type="number"
                        placeholder="0"
                        min="0"
                        step={DECIMAL_STEP}
                        value={quantities[item.itemId] ?? ''}
                        onChange={(e) => setQuantities((q) => ({ ...q, [item.itemId]: e.target.value }))}
                      />
                      {item.availableQty != null && (
                        <p className="text-[11px] text-muted-foreground">Avail: {item.availableQty.toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                ))}
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
