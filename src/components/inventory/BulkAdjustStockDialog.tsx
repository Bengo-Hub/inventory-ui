'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useBulkAdjustStock } from '@/hooks/useStock';
import { ActiveWarehousePicker } from '@/components/inventory/ActiveWarehousePicker';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { ADJUSTMENT_REASON_OPTIONS } from '@/lib/adjustment-reasons';
import { apiErrorMessage } from '@/lib/api/error-message';
import { parseDecimal, DECIMAL_STEP } from '@/lib/utils';
import { X } from 'lucide-react';
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
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  // Optional per-row destination — when set, this line moves stock to another warehouse
  // (transfer_out at the source + transfer_in there) instead of adjusting in place.
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
      .map((i) => ({
        sku: i.sku,
        adjustment: parseDecimal(adjustments[i.sku] ?? ''),
        destination_warehouse_id: destinations[i.sku] || undefined,
      }))
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
      <div className="relative z-50 w-full max-w-lg max-h-[90vh] flex flex-col">
        <Card className="flex flex-col overflow-hidden max-h-[90vh]">
          <CardHeader className="shrink-0">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{isBatch ? `Adjust ${items.length} items` : 'Adjust stock'}</h2>
              <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              One warehouse and reason apply to every line below; enter a positive or negative
              quantity per item. Optionally pick a destination warehouse per row to move that
              quantity there instead of adjusting in place.
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
                {items.map((item) => (
                  <div key={item.sku} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">{item.sku}</p>
                    </div>
                    <div className="w-32 shrink-0">
                      <Input
                        type="number"
                        placeholder="+/- qty"
                        step={DECIMAL_STEP}
                        value={adjustments[item.sku] ?? ''}
                        onChange={(e) => setAdjustments((a) => ({ ...a, [item.sku]: e.target.value }))}
                      />
                    </div>
                    <div className="w-40 shrink-0">
                      <CreatableSelect
                        value={destinations[item.sku] ?? ''}
                        onChange={(v) => setDestinations((d) => ({ ...d, [item.sku]: v }))}
                        options={(warehouses ?? [])
                          .filter((wh) => wh.id !== warehouse.warehouseId)
                          .map((wh) => ({ id: wh.id, name: wh.name }))}
                        placeholder="Move to… (optional)"
                      />
                    </div>
                  </div>
                ))}
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
