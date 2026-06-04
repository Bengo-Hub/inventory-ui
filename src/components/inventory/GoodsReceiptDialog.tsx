'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useCreateGoodsReceipt } from '@/hooks/useGoodsReceipts';
import { usePurchaseOrders, usePurchaseOrder } from '@/hooks/usePurchaseOrders';
import { type CreateGRNLineInput } from '@/lib/api/goods-receipts';
import { X } from 'lucide-react';
import { useState } from 'react';
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
    const [accepted, setAccepted] = useState<Record<string, string>>({});

    const { data: orders } = usePurchaseOrders(org);
    const receivablePOs = (orders ?? []).filter((o) => ['sent', 'partially_received', 'draft'].includes(o.status));
    const { data: po } = usePurchaseOrder(org, poId);
    const create = useCreateGoodsReceipt(org, poId);

    const outstanding = (lineQty: number, recvd: number) => Math.max(0, lineQty - (recvd || 0));

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!poId || !po) { toast.error('Select a purchase order'); return; }
        const lines: CreateGRNLineInput[] = (po.line_items ?? [])
            .map((l) => {
                const acc = accepted[l.id] !== undefined ? Number(accepted[l.id]) : outstanding(l.quantity, l.received_qty);
                return { purchase_order_line_id: l.id, item_id: l.item_id, quantity_received: acc, quantity_accepted: acc, unit_cost: l.unit_cost };
            })
            .filter((l) => l.quantity_received > 0);
        if (lines.length === 0) { toast.error('Enter at least one received quantity'); return; }
        create.mutate({ notes: notes.trim() || undefined, lines }, {
            onSuccess: () => { toast.success('Goods receipt created (draft) — post it to update stock'); onCreated(); },
            onError: () => toast.error('Failed to create goods receipt'),
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
                                <select className={selectClass} value={poId} onChange={(e) => { setPoId(e.target.value); setAccepted({}); }} required>
                                    <option value="">— Select a sent / partially-received PO —</option>
                                    {receivablePOs.map((o) => <option key={o.id} value={o.id}>{o.po_number} — {o.supplier_name ?? ''} ({o.status})</option>)}
                                </select>
                            </div>

                            {po && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Receive Lines</label>
                                    <div className="rounded-lg border border-border divide-y divide-border">
                                        {(po.line_items ?? []).map((l) => {
                                            const out = outstanding(l.quantity, l.received_qty);
                                            return (
                                                <div key={l.id} className="grid grid-cols-12 gap-2 items-center px-3 py-2">
                                                    <div className="col-span-6">
                                                        <p className="text-sm font-medium truncate">{l.item_name ?? l.item_sku ?? l.item_id.slice(0, 8)}</p>
                                                        <p className="text-xs text-muted-foreground">ordered {l.quantity} · received {l.received_qty ?? 0}</p>
                                                    </div>
                                                    <div className="col-span-3 text-xs text-muted-foreground text-right">outstanding {out}</div>
                                                    <Input className="col-span-3" type="number" min="0" max={out} value={accepted[l.id] ?? String(out)} onChange={(e) => setAccepted((s) => ({ ...s, [l.id]: e.target.value }))} />
                                                </div>
                                            );
                                        })}
                                        {(po.line_items?.length ?? 0) === 0 && <p className="px-3 py-4 text-sm text-muted-foreground text-center">This PO has no line items.</p>}
                                    </div>
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
