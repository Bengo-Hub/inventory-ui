'use client';

// Receive repaired goods back from a service provider. Per line the user says how many units
// came back repaired and how many could not be repaired (written off); the rest stays out.
// Mirrors the server's rule (returned + written off cannot exceed what is still at the provider).

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useReceiveServiceReturn } from '@/hooks/usePurchaseReturns';
import type { PurchaseReturn } from '@/lib/api/purchase-returns';
import { apiErrorMessage } from '@/lib/api/error-message';
import { DECIMAL_STEP, localDateInput, parseDecimal, roundDecimal } from '@/lib/utils';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

interface Props {
  org: string;
  /** The order being received; null closes the dialog. */
  order: PurchaseReturn | null;
  onClose: () => void;
}

interface Entry { returned: string; writtenOff: string }

export function ReceiveBackDialog({ org, order, onClose }: Props) {
  const receive = useReceiveServiceReturn(org);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [date, setDate] = useState(() => localDateInput());
  const [notes, setNotes] = useState('');

  // Re-seed on every open: the line list and the default day belong to the order being shown.
  useEffect(() => {
    if (!order) return;
    const seeded: Record<string, Entry> = {};
    for (const l of order.lines) seeded[l.id] = { returned: l.outstanding_qty > 0 ? String(l.outstanding_qty) : '', writtenOff: '' };
    setEntries(seeded);
    setDate(localDateInput());
    setNotes('');
  }, [order]);

  if (!order) return null;

  const set = (id: string, patch: Partial<Entry>) => setEntries((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  const open = order.lines.filter((l) => l.outstanding_qty > 0);

  const problems = open.map((l) => {
    const e = entries[l.id] ?? { returned: '', writtenOff: '' };
    const total = roundDecimal(parseDecimal(e.returned) + parseDecimal(e.writtenOff));
    return total > l.outstanding_qty ? `${l.item_name}: only ${l.outstanding_qty.toLocaleString()} still out` : '';
  }).filter(Boolean);
  const anything = open.some((l) => {
    const e = entries[l.id];
    return e && (parseDecimal(e.returned) > 0 || parseDecimal(e.writtenOff) > 0);
  });

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!order) return;
    if (!anything) { toast.error('Enter how many units came back or could not be repaired'); return; }
    if (problems.length) { toast.error(problems[0]); return; }
    receive.mutate({
      id: order.id,
      data: {
        date: date || undefined,
        notes: notes.trim() || undefined,
        lines: open.map((l) => ({
          line_id: l.id,
          returned_qty: parseDecimal(entries[l.id]?.returned),
          written_off_qty: parseDecimal(entries[l.id]?.writtenOff),
        })),
      },
    }, {
      onSuccess: (res) => {
        toast.success(res.service_status === 'out' || res.service_status === 'partial'
          ? `${order.return_number}: items received, ${res.outstanding_quantity.toLocaleString()} still out for repair`
          : `${order.return_number}: all items settled`);
        onClose();
      },
      onError: async (err) => toast.error(await apiErrorMessage(err, 'Failed to receive the items')),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Receive back from repair</h2>
                <p className="text-xs text-muted-foreground">{order.return_number}{order.service_provider ? ` · ${order.service_provider}` : ''}</p>
              </div>
              <button onClick={onClose} aria-label="Close" className="p-1 rounded-lg hover:bg-accent transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Repaired units go back into stock at the cost they left with. Units that could not be repaired are written off. Anything you leave blank stays out for repair.
              </p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Still out</th>
                      <th className="px-3 py-2 text-right">Came back</th>
                      <th className="px-3 py-2 text-right">Not repairable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {open.map((l) => (
                      <tr key={l.id}>
                        <td className="px-3 py-2">
                          <p className="font-medium">{l.item_name}</p>
                          {l.sku && <p className="text-[11px] text-muted-foreground font-mono">{l.sku}</p>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{l.outstanding_qty.toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <Input className="w-24 ml-auto text-right" type="number" min="0" max={l.outstanding_qty} step={DECIMAL_STEP} aria-label={`${l.item_name} came back`} value={entries[l.id]?.returned ?? ''} onChange={(e) => set(l.id, { returned: e.target.value })} />
                        </td>
                        <td className="px-3 py-2">
                          <Input className="w-24 ml-auto text-right" type="number" min="0" max={l.outstanding_qty} step={DECIMAL_STEP} aria-label={`${l.item_name} not repairable`} value={entries[l.id]?.writtenOff ?? ''} onChange={(e) => set(l.id, { writtenOff: e.target.value })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {problems.length > 0 && <p className="text-xs text-red-600">{problems[0]}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="rb-date">Date received</label>
                  <Input id="rb-date" type="date" value={date} max={localDateInput()} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="rb-notes">Notes</label>
                  <Input id="rb-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Battery replaced" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                <Button type="submit" className="flex-1" disabled={receive.isPending || problems.length > 0}>{receive.isPending ? 'Saving…' : 'Receive items'}</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
