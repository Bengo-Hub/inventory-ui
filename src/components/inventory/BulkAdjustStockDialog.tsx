'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useBulkAdjustStock } from '@/hooks/useStock';
import { ActiveWarehousePicker } from '@/components/inventory/ActiveWarehousePicker';
import { ADJUSTMENT_REASON_OPTIONS } from '@/lib/adjustment-reasons';
import { apiErrorMessage } from '@/lib/api/error-message';
import { cn } from '@/lib/utils';
import { parseDecimal, DECIMAL_STEP } from '@/lib/utils';
import { Minus, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export interface BulkAdjustStockItem {
  sku: string;
  name: string;
}

interface BulkAdjustStockDialogProps {
  orgSlug: string;
  /** Rows selected on whichever page opened this — Products, Stock Levels, or Adjustments. */
  items: BulkAdjustStockItem[];
  onClose: () => void;
  onDone?: () => void;
}

/**
 * BulkAdjustStockDialog — the ONE shared "adjust many items at once" dialog, opened from the
 * Products/Catalog page, the Stock Levels page, and the Stock Adjustments page's own bulk
 * selection — so the three surfaces never grow three divergent bulk-adjust implementations.
 * One shared warehouse + reason + notes, a per-item +/- delta. Each line posts through the same
 * AdjustStock path a single adjustment uses (see stock.BulkAdjustStock's doc comment) — lines
 * that fail (including one that trips the manager-approval threshold, which bulk doesn't itself
 * gate) are reported back per item rather than silently dropped or blocking the rest.
 *
 * Runs as a background job: submitting queues it and closes the dialog immediately (never blocks
 * on how many lines there are); the real per-item result arrives via a toast once the job
 * completes (org-shell's notification listener) or via useBulkJobStatus polling.
 */
export function BulkAdjustStockDialog({ orgSlug, items, onClose, onDone }: BulkAdjustStockDialogProps) {
  const warehouse = useActiveWarehouse(orgSlug);
  const { data: warehouses } = useWarehouses(orgSlug);
  const [reason, setReason] = useState('correction');
  const [notes, setNotes] = useState('');
  // adjustments holds the POSITIVE quantity the user typed; direction ('add'/'remove', default
  // 'add') decides the sign applied at submit — replaces the old single "+/- qty" text field,
  // which several users misread as always meaning "add" (typing e.g. "3" to remove 3 did nothing
  // visually different from adding 3, so a removal typed without the minus sign silently added
  // stock instead).
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [directions, setDirections] = useState<Record<string, 'add' | 'remove'>>({});
  // Optional per-row destination — when set, this line moves stock to another warehouse
  // (transfer_out at the source + transfer_in there) instead of adjusting in place. A "move" has
  // no add/remove concept of its own (the backend always moves the full typed quantity regardless
  // of sign), so the direction toggle is hidden for a row once a destination is picked.
  const [destinations, setDestinations] = useState<Record<string, string>>({});

  const bulkAdjust = useBulkAdjustStock(orgSlug);
  const isBusy = bulkAdjust.isPending;
  const isBatch = items.length > 1;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (warehouse.unresolved) {
      toast.error('Select the warehouse before submitting');
      return;
    }
    if (!warehouse.warehouseId) {
      toast.error('Select a warehouse');
      return;
    }
    const lines = items
      .map((i) => {
        const qty = Math.abs(parseDecimal(adjustments[i.sku] ?? ''));
        const hasDestination = !!destinations[i.sku];
        // A move's sign doesn't matter (the backend always moves the full typed quantity), so
        // only apply the remove-direction sign for an in-place adjustment.
        const signed = !hasDestination && (directions[i.sku] ?? 'add') === 'remove' ? -qty : qty;
        return {
          sku: i.sku,
          adjustment: signed,
          destination_warehouse_id: destinations[i.sku] || undefined,
        };
      })
      .filter((l) => l.adjustment !== 0);
    if (lines.length === 0) {
      toast.error('Enter a non-zero adjustment for at least one item');
      return;
    }

    try {
      const job = await bulkAdjust.mutateAsync({
        lines,
        reason,
        notes: notes.trim() || undefined,
        warehouse_id: warehouse.warehouseId,
      });
      toast.info(
        `Applying the adjustment to ${lines.length} item${lines.length === 1 ? '' : 's'} in the background — you'll be notified when it's done.`,
        { description: `Job ${job.job_id.slice(0, 8)}…`, duration: 5000 },
      );
      onDone?.();
      onClose();
    } catch (err) {
      toast.error(await apiErrorMessage(err, 'Failed to queue the bulk adjustment'));
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl max-h-[90vh] flex flex-col">
        <Card className="flex flex-col overflow-hidden max-h-[90vh]">
          <CardHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{isBatch ? `Adjust ${items.length} items` : 'Adjust stock'}</h2>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              One warehouse and reason apply to every line below. Pick Add or Remove and enter a
              quantity per item, or pick a destination warehouse to move that quantity there
              instead of adjusting in place.
            </p>
          </CardHeader>
          <CardContent className="overflow-y-auto flex-1">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <ActiveWarehousePicker active={warehouse} label="Warehouse" required />
                <div className="space-y-2">
                  <label className="text-sm font-medium">Reason *</label>
                  <select
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                  >
                    {ADJUSTMENT_REASON_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Adjustment per item</p>
                {items.map((item) => {
                  const hasDestination = !!destinations[item.sku];
                  const direction = directions[item.sku] ?? 'add';
                  return (
                    <div key={item.sku} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                      </div>
                      {/* Add/Remove toggle — replaces the old sign-in-the-number-field convention
                          that several users misread (typing "3" to remove looked identical to
                          adding 3). Hidden once a destination is picked: a move has no add/remove
                          concept of its own, it always moves the full typed quantity. */}
                      {!hasDestination && (
                        <div className="flex shrink-0 rounded-lg border border-input overflow-hidden">
                          <button
                            type="button"
                            onClick={() => setDirections((d) => ({ ...d, [item.sku]: 'add' }))}
                            title="Add stock"
                            className={cn(
                              'flex items-center gap-1 px-2 h-9 text-xs font-medium transition-colors',
                              direction === 'add' ? 'bg-green-600 text-white' : 'bg-background text-muted-foreground hover:bg-accent',
                            )}
                          >
                            <Plus className="h-3.5 w-3.5" /> Add
                          </button>
                          <button
                            type="button"
                            onClick={() => setDirections((d) => ({ ...d, [item.sku]: 'remove' }))}
                            title="Remove stock"
                            className={cn(
                              'flex items-center gap-1 px-2 h-9 text-xs font-medium border-l border-input transition-colors',
                              direction === 'remove' ? 'bg-red-600 text-white' : 'bg-background text-muted-foreground hover:bg-accent',
                            )}
                          >
                            <Minus className="h-3.5 w-3.5" /> Remove
                          </button>
                        </div>
                      )}
                      <div className="w-24 shrink-0">
                        <Input
                          type="number"
                          min="0"
                          placeholder="Qty"
                          step={DECIMAL_STEP}
                          value={adjustments[item.sku] ?? ''}
                          onChange={(e) => setAdjustments((a) => ({ ...a, [item.sku]: e.target.value }))}
                        />
                      </div>
                      <div className="w-36 shrink-0">
                        {/* Plain native <select>, not the shared searchable combobox — that
                            component's dropdown positions absolute/non-portaled, which clips
                            invisible inside this dialog's scrollable body (the reported "options
                            aren't loading" bug; the warehouses ARE there, the popup just renders
                            off-screen). A native select has no such failure mode. */}
                        <select
                          value={destinations[item.sku] ?? ''}
                          onChange={(e) => setDestinations((d) => ({ ...d, [item.sku]: e.target.value }))}
                          className="w-full h-9 rounded-lg border border-input bg-background px-2 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                        >
                          <option value="">Move to… (optional)</option>
                          {(warehouses ?? [])
                            .filter((wh) => wh.id !== warehouse.warehouseId)
                            .map((wh) => (
                              <option key={wh.id} value={wh.id}>{wh.name}</option>
                            ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Note</label>
                <Input
                  placeholder="Optional note for this adjustment..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={isBusy}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={isBusy}>
                  {isBusy ? 'Applying...' : 'Apply adjustment'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
