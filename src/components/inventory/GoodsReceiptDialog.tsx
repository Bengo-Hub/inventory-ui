'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useCreateGoodsReceipt } from '@/hooks/useGoodsReceipts';
import { usePurchaseOrders, usePurchaseOrder } from '@/hooks/usePurchaseOrders';
import { useItems } from '@/hooks/useItems';
import { type CreateGRNLineInput } from '@/lib/api/goods-receipts';
import { apiErrorMessage } from '@/lib/api/error-message';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

interface Props {
    org: string;
    onClose: () => void;
    onCreated: () => void;
}

const selectClass = 'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';

export function GoodsReceiptDialog({ org, onClose, onCreated }: Props) {
    const [poId, setPoId] = useState('');
    const [notes, setNotes] = useState('');
    const [received, setReceived] = useState<Record<string, string>>({});
    const [rejected, setRejected] = useState<Record<string, string>>({});
    const [reason, setReason] = useState<Record<string, string>>({});
    // Free-text serials per line (comma / space / newline separated). Optional — only for
    // serial-tracked items, where the backend requires one unique serial per accepted unit.
    const [serials, setSerials] = useState<Record<string, string>>({});
    // Per-line lot/batch capture: lot number + expiry date. Required-ish for lot-tracked or
    // perishable items (backend creates an InventoryLot layer for FIFO/FEFO costing on post),
    // optional otherwise.
    const [lotNumber, setLotNumber] = useState<Record<string, string>>({});
    const [expiryDate, setExpiryDate] = useState<Record<string, string>>({});

    const { data: orders } = usePurchaseOrders(org);
    const receivablePOs = (orders ?? []).filter((o) => ['sent', 'partially_received', 'draft'].includes(o.status));
    const { data: po } = usePurchaseOrder(org, poId);
    const create = useCreateGoodsReceipt(org, poId);

    // Map item_id -> lot-tracking flags so we can surface lot/expiry inputs only where relevant.
    const { data: itemsPage } = useItems(org, { limit: 500 });
    const lotInfo = useMemo(() => {
        const m = new Map<string, { track: boolean }>();
        for (const it of itemsPage?.data ?? []) {
            m.set(it.id, { track: !!it.track_lots || !!it.is_perishable });
        }
        return m;
    }, [itemsPage]);

    const outstanding = (lineQty: number, recvd: number) => Math.max(0, lineQty - (recvd || 0));
    const resetLines = () => { setReceived({}); setRejected({}); setReason({}); setSerials({}); setLotNumber({}); setExpiryDate({}); };
    const parseSerials = (raw: string | undefined) =>
        (raw ?? '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!poId || !po) { toast.error('Select a purchase order'); return; }
        let invalid = false;
        const lines: CreateGRNLineInput[] = (po.line_items ?? [])
            .map((l) => {
                const out = outstanding(l.quantity, l.received_qty);
                const rec = received[l.id] !== undefined ? Number(received[l.id]) : out;
                const rej = rejected[l.id] !== undefined ? Number(rejected[l.id]) : 0;
                const acc = rec - rej;
                if (rej > rec || acc < 0) invalid = true;
                const sn = parseSerials(serials[l.id]);
                const lot = lotNumber[l.id]?.trim();
                const exp = expiryDate[l.id];
                return {
                    purchase_order_line_id: l.id,
                    item_id: l.item_id,
                    quantity_received: rec,
                    quantity_accepted: acc,
                    quantity_rejected: rej,
                    rejection_reason: rej > 0 ? (reason[l.id]?.trim() || undefined) : undefined,
                    unit_cost: l.unit_cost,
                    serials: sn.length > 0 ? sn : undefined,
                    lot_number: lot || undefined,
                    // <input type="date"> gives YYYY-MM-DD; backend expects RFC3339.
                    expiry_date: exp ? new Date(exp).toISOString() : undefined,
                };
            })
            .filter((l) => l.quantity_received > 0);
        if (invalid) { toast.error('Rejected quantity cannot exceed received quantity'); return; }
        if (lines.length === 0) { toast.error('Enter at least one received quantity'); return; }
        create.mutate({ notes: notes.trim() || undefined, lines }, {
            onSuccess: () => { toast.success('Goods receipt created (draft) — post it to update stock'); onCreated(); },
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create goods receipt')),
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">New Goods Receipt</h2>
                            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Purchase Order *</label>
                                <select className={selectClass} value={poId} onChange={(e) => { setPoId(e.target.value); resetLines(); }} required>
                                    <option value="">— Select a sent / partially-received PO —</option>
                                    {receivablePOs.map((o) => <option key={o.id} value={o.id}>{o.po_number} — {o.supplier_name ?? ''} ({o.status})</option>)}
                                </select>
                            </div>

                            {po && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Receive Lines</label>
                                    <div className="hidden sm:grid grid-cols-12 gap-2 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                        <span className="col-span-5">Item</span>
                                        <span className="col-span-2 text-right">Received</span>
                                        <span className="col-span-2 text-right">Rejected</span>
                                        <span className="col-span-3">Reject reason</span>
                                    </div>
                                    <div className="rounded-lg border border-border divide-y divide-border">
                                        {(po.line_items ?? []).map((l) => {
                                            const out = outstanding(l.quantity, l.received_qty);
                                            const rec = received[l.id] !== undefined ? Number(received[l.id]) : out;
                                            const rej = rejected[l.id] !== undefined ? Number(rejected[l.id]) : 0;
                                            const acc = Math.max(0, rec - rej);
                                            const snCount = parseSerials(serials[l.id]).length;
                                            const snMismatch = snCount > 0 && snCount !== acc;
                                            const lotTracked = lotInfo.get(l.item_id)?.track ?? false;
                                            return (
                                                <div key={l.id} className="px-3 py-2 space-y-1.5">
                                                  <div className="grid grid-cols-12 gap-2 items-center">
                                                    <div className="col-span-5">
                                                        <p className="text-sm font-medium truncate">{l.item_name ?? l.item_sku ?? l.item_id.slice(0, 8)}</p>
                                                        <p className="text-xs text-muted-foreground">ordered {l.quantity} · prev. received {l.received_qty ?? 0} · outstanding {out} · accepted {acc}</p>
                                                    </div>
                                                    <Input className="col-span-2" type="number" min="0" value={received[l.id] ?? String(out)} onChange={(e) => setReceived((s) => ({ ...s, [l.id]: e.target.value }))} />
                                                    <Input className="col-span-2" type="number" min="0" max={rec} value={rejected[l.id] ?? ''} placeholder="0" onChange={(e) => setRejected((s) => ({ ...s, [l.id]: e.target.value }))} />
                                                    <Input className="col-span-3" type="text" placeholder="e.g. damaged" value={reason[l.id] ?? ''} disabled={rej <= 0} onChange={(e) => setReason((s) => ({ ...s, [l.id]: e.target.value }))} />
                                                  </div>
                                                  <details className="text-xs">
                                                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                                                      Serial numbers {snCount > 0 ? `(${snCount}/${acc})` : '(optional — serial-tracked items)'}
                                                    </summary>
                                                    <textarea
                                                      className="mt-1 w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                                                      rows={2}
                                                      placeholder="One serial per accepted unit — separate by comma, space, or new line"
                                                      value={serials[l.id] ?? ''}
                                                      onChange={(e) => setSerials((s) => ({ ...s, [l.id]: e.target.value }))}
                                                    />
                                                    {snMismatch && (
                                                      <p className="text-destructive">Enter exactly {acc} serial(s) to match accepted units (serial-tracked items), or leave blank.</p>
                                                    )}
                                                  </details>

                                                  {/* Lot/batch capture — shown prominently for lot-tracked/perishable items,
                                                      collapsed-optional otherwise. Posts a FIFO/FEFO InventoryLot layer on GRN post. */}
                                                  {lotTracked ? (
                                                    <div className="grid grid-cols-2 gap-2">
                                                      <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-muted-foreground">Lot / batch no.</label>
                                                        <Input type="text" placeholder="e.g. LOT-2406" value={lotNumber[l.id] ?? ''} onChange={(e) => setLotNumber((s) => ({ ...s, [l.id]: e.target.value }))} />
                                                      </div>
                                                      <div className="space-y-1">
                                                        <label className="text-[11px] font-medium text-muted-foreground">Expiry date</label>
                                                        <Input type="date" value={expiryDate[l.id] ?? ''} onChange={(e) => setExpiryDate((s) => ({ ...s, [l.id]: e.target.value }))} />
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <details className="text-xs">
                                                      <summary className="cursor-pointer text-muted-foreground hover:text-foreground select-none">
                                                        Lot / expiry {(lotNumber[l.id] || expiryDate[l.id]) ? '(set)' : '(optional)'}
                                                      </summary>
                                                      <div className="mt-1 grid grid-cols-2 gap-2">
                                                        <Input type="text" placeholder="Lot / batch no." value={lotNumber[l.id] ?? ''} onChange={(e) => setLotNumber((s) => ({ ...s, [l.id]: e.target.value }))} />
                                                        <Input type="date" value={expiryDate[l.id] ?? ''} onChange={(e) => setExpiryDate((s) => ({ ...s, [l.id]: e.target.value }))} />
                                                      </div>
                                                    </details>
                                                  )}
                                                </div>
                                            );
                                        })}
                                        {(po.line_items?.length ?? 0) === 0 && <p className="px-3 py-4 text-sm text-muted-foreground text-center">This PO has no line items.</p>}
                                    </div>
                                    <p className="text-xs text-muted-foreground">Accepted = Received − Rejected. Rejected units are recorded for the purchase-return flow and are excluded from the supplier bill.</p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Notes</label>
                                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                                <Button type="submit" className="flex-1" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create Receipt'}</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
