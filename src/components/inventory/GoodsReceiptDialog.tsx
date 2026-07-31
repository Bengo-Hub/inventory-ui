'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useCreateGoodsReceipt } from '@/hooks/useGoodsReceipts';
import { usePurchaseOrders, usePurchaseOrder } from '@/hooks/usePurchaseOrders';
import { useItems } from '@/hooks/useItems';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import { ActiveWarehousePicker } from '@/components/inventory/ActiveWarehousePicker';
import { type CreateGRNLineInput } from '@/lib/api/goods-receipts';
import { apiErrorMessage } from '@/lib/api/error-message';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';
import { DollarSign, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
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
    // Actual unit cost paid on THIS receipt — pre-filled from the PO line but editable, since the
    // supplier's delivered price often differs from what was originally ordered. This is the value
    // that becomes the new stock's own cost layer; it never rewrites the cost of stock already on
    // hand (see InventoryLot cost layers / postGoodsReceiptCore).
    const [unitCost, setUnitCost] = useState<Record<string, string>>({});
    // Selling-price adjustment captured alongside this receipt's cost — optional. scope decides
    // whether it applies immediately to all stock (default — matches editing the price from the
    // item screen) or is queued so only stock received from now on carries the new price, with
    // existing stock selling at its current price until it's gone.
    const [newPrice, setNewPrice] = useState<Record<string, string>>({});
    const [priceScope, setPriceScope] = useState<Record<string, 'all_stock' | 'new_stock_only'>>({});
    // Free-text serials per line (comma / space / newline separated). Optional — only for
    // serial-tracked items, where the backend requires one unique serial per accepted unit.
    const [serials, setSerials] = useState<Record<string, string>>({});
    // Per-line lot/batch capture: lot number + expiry date. Required-ish for lot-tracked or
    // perishable items (backend creates an InventoryLot layer for FIFO/FEFO costing on post),
    // optional otherwise.
    const [lotNumber, setLotNumber] = useState<Record<string, string>>({});
    const [expiryDate, setExpiryDate] = useState<Record<string, string>>({});

    // Dropdown of open POs to receive against — pull the max page size rather than paginating.
    const { data: ordersPage } = usePurchaseOrders(org, { limit: 100 });
    const receivablePOs = (ordersPage?.data ?? []).filter((o) => ['sent', 'partially_received', 'draft'].includes(o.status));
    const { data: po } = usePurchaseOrder(org, poId);
    const create = useCreateGoodsReceipt(org, poId);

    // Branch resolution: the receiving warehouse defaults to the selected PO's warehouse; if the
    // PO has none it falls back to the active outlet's warehouse and (under "All Outlets")
    // requires an explicit pick before posting. Receiving into the wrong branch corrupts stock.
    const receivingWarehouse = useActiveWarehouse(org);
    useEffect(() => {
        if (po?.warehouse_id) receivingWarehouse.setWarehouseId(po.warehouse_id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [po?.warehouse_id]);

    // Carry through a selling-price decision made when this PO was placed/amended — the buyer
    // already decided whether a price change applies to all stock or new stock only, so the
    // receiving clerk shouldn't have to re-decide it from scratch. Still fully editable below:
    // this only seeds the initial values once per PO selection.
    useEffect(() => {
        if (!po?.line_items?.length) return;
        setNewPrice((s) => {
            const next = { ...s };
            for (const l of po.line_items) {
                if (l.new_selling_price != null && next[l.id] === undefined) {
                    next[l.id] = String(l.new_selling_price);
                }
            }
            return next;
        });
        setPriceScope((s) => {
            const next = { ...s };
            for (const l of po.line_items) {
                if (l.new_selling_price != null && next[l.id] === undefined) {
                    next[l.id] = l.price_scope ?? 'all_stock';
                }
            }
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [po?.id]);

    // Map item_id -> lot-tracking flags so we can surface lot/expiry inputs only where relevant.
    const { data: itemsPage } = useItems(org, { limit: 500 });
    const lotInfo = useMemo(() => {
        const m = new Map<string, { track: boolean; currentPrice?: number }>();
        for (const it of itemsPage?.data ?? []) {
            const currentPrice = it.selling_price ?? it.max_selling_price ?? undefined;
            m.set(it.id, { track: !!it.track_lots || !!it.is_perishable, currentPrice: currentPrice ?? undefined });
        }
        return m;
    }, [itemsPage]);

    const outstanding = (lineQty: number, recvd: number) => Math.max(0, lineQty - (recvd || 0));
    const resetLines = () => { setReceived({}); setRejected({}); setReason({}); setSerials({}); setLotNumber({}); setExpiryDate({}); setUnitCost({}); setNewPrice({}); setPriceScope({}); };
    const parseSerials = (raw: string | undefined) =>
        (raw ?? '').split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!poId || !po) { toast.error('Select a purchase order'); return; }
        let invalid = false;
        const lines: CreateGRNLineInput[] = (po.line_items ?? [])
            .map((l) => {
                const out = outstanding(l.quantity, l.received_qty);
                const rec = received[l.id] !== undefined ? parseDecimal(received[l.id]) : out;
                const rej = rejected[l.id] !== undefined ? parseDecimal(rejected[l.id]) : 0;
                const acc = rec - rej;
                if (rej > rec || acc < 0) invalid = true;
                const sn = parseSerials(serials[l.id]);
                const lot = lotNumber[l.id]?.trim();
                const exp = expiryDate[l.id];
                const cost = unitCost[l.id] !== undefined ? parseDecimal(unitCost[l.id]) : l.unit_cost;
                const priceStr = newPrice[l.id]?.trim();
                const price = priceStr ? parseDecimal(priceStr) : undefined;
                return {
                    purchase_order_line_id: l.id,
                    item_id: l.item_id,
                    quantity_received: rec,
                    quantity_accepted: acc,
                    quantity_rejected: rej,
                    rejection_reason: rej > 0 ? (reason[l.id]?.trim() || undefined) : undefined,
                    unit_cost: cost,
                    serials: sn.length > 0 ? sn : undefined,
                    lot_number: lot || undefined,
                    // <input type="date"> gives YYYY-MM-DD; backend expects RFC3339.
                    expiry_date: exp ? new Date(exp).toISOString() : undefined,
                    new_selling_price: price && price > 0 ? price : undefined,
                    price_scope: price && price > 0 ? (priceScope[l.id] ?? 'all_stock') : undefined,
                };
            })
            .filter((l) => l.quantity_received > 0);
        if (invalid) { toast.error('Rejected quantity cannot exceed received quantity'); return; }
        if (lines.length === 0) { toast.error('Enter at least one received quantity'); return; }
        if (receivingWarehouse.unresolved) { toast.error('Select the receiving warehouse before posting'); return; }
        create.mutate({ warehouse_id: receivingWarehouse.warehouseId || undefined, notes: notes.trim() || undefined, lines }, {
            onSuccess: () => { toast.success('Goods receipt created (draft) — post it to update stock'); onCreated(); },
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create goods receipt')),
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
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
                                <ActiveWarehousePicker
                                    active={receivingWarehouse}
                                    label="Receiving Warehouse"
                                    required
                                />
                            )}

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
                                            const rec = received[l.id] !== undefined ? parseDecimal(received[l.id]) : out;
                                            const rej = rejected[l.id] !== undefined ? parseDecimal(rejected[l.id]) : 0;
                                            const acc = Math.max(0, rec - rej);
                                            const snCount = parseSerials(serials[l.id]).length;
                                            const snMismatch = snCount > 0 && snCount !== acc;
                                            const info = lotInfo.get(l.item_id);
                                            const lotTracked = info?.track ?? false;
                                            const currentPrice = info?.currentPrice;
                                            const costStr = unitCost[l.id];
                                            const cost = costStr !== undefined ? parseDecimal(costStr) : l.unit_cost;
                                            const costChanged = Number.isFinite(cost) && cost !== l.unit_cost;
                                            const costDeltaPct = costChanged && l.unit_cost > 0 ? ((cost - l.unit_cost) / l.unit_cost) * 100 : 0;
                                            const priceStr = newPrice[l.id];
                                            const priceEntered = priceStr !== undefined && priceStr.trim() !== '';
                                            const priceVal = priceEntered ? parseDecimal(priceStr) : undefined;
                                            const priceChanged = priceEntered && currentPrice !== undefined && Number.isFinite(priceVal) && priceVal !== currentPrice;
                                            const scope = priceScope[l.id] ?? 'all_stock';
                                            return (
                                                <div key={l.id} className="px-3 py-2 space-y-1.5">
                                                  <div className="grid grid-cols-12 gap-2 items-center">
                                                    <div className="col-span-5">
                                                        <p className="text-sm font-medium truncate">{l.item_name ?? l.item_sku ?? l.item_id.slice(0, 8)}</p>
                                                        <p className="text-xs text-muted-foreground">ordered {l.quantity} · prev. received {l.received_qty ?? 0} · outstanding {out} · accepted {acc}</p>
                                                    </div>
                                                    <Input className="col-span-2" type="number" min="0" step={DECIMAL_STEP} value={received[l.id] ?? String(out)} onChange={(e) => setReceived((s) => ({ ...s, [l.id]: e.target.value }))} />
                                                    <Input className="col-span-2" type="number" min="0" max={rec} step={DECIMAL_STEP} value={rejected[l.id] ?? ''} placeholder="0" onChange={(e) => setRejected((s) => ({ ...s, [l.id]: e.target.value }))} />
                                                    <Input className="col-span-3" type="text" placeholder="e.g. damaged" value={reason[l.id] ?? ''} disabled={rej <= 0} onChange={(e) => setReason((s) => ({ ...s, [l.id]: e.target.value }))} />
                                                  </div>
                                                  <div className="grid grid-cols-12 gap-2 items-center">
                                                    <label className="col-span-5 text-[11px] font-medium text-muted-foreground">
                                                      Actual unit cost <span className="font-semibold text-foreground">(PO price: {l.unit_cost.toFixed(2)})</span>
                                                      {costChanged && (
                                                        <span className={costDeltaPct >= 0 ? 'ml-1 text-amber-600' : 'ml-1 text-emerald-600'}>
                                                          {costDeltaPct >= 0 ? '+' : ''}{costDeltaPct.toFixed(1)}%
                                                        </span>
                                                      )}
                                                    </label>
                                                    <Input
                                                      className="col-span-3"
                                                      type="number"
                                                      min="0"
                                                      step={DECIMAL_STEP}
                                                      value={costStr ?? String(l.unit_cost)}
                                                      onChange={(e) => setUnitCost((s) => ({ ...s, [l.id]: e.target.value }))}
                                                    />
                                                  </div>
                                                  {costChanged && (
                                                    <p className="text-[11px] text-muted-foreground">
                                                      This receipt's stock will carry its own cost ({cost.toFixed(2)}) — stock already on hand keeps what it actually cost.
                                                    </p>
                                                  )}

                                                  {/* Selling-price adjustment — always visible (not a collapsed disclosure)
                                                      so it reads as a first-class part of receiving, not an easy-to-miss extra. */}
                                                  <div className={`rounded-lg border-2 p-2.5 space-y-2 ${priceEntered ? 'border-primary/50 bg-primary/6' : 'border-dashed border-primary/25 bg-primary/2'}`}>
                                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                                                      <DollarSign className="h-3.5 w-3.5 text-primary" />
                                                      Selling price adjustment
                                                    </div>
                                                    <div className="grid grid-cols-12 gap-2 items-center">
                                                      <label className="col-span-5 text-[11px] font-medium text-muted-foreground">
                                                        New selling price
                                                        {currentPrice !== undefined && <span className="ml-1 font-semibold text-foreground">(current: {currentPrice.toFixed(2)})</span>}
                                                      </label>
                                                      <Input
                                                        className="col-span-3"
                                                        type="number"
                                                        min="0"
                                                        step={DECIMAL_STEP}
                                                        placeholder={currentPrice !== undefined ? currentPrice.toFixed(2) : 'Optional'}
                                                        value={priceStr ?? ''}
                                                        onChange={(e) => setNewPrice((s) => ({ ...s, [l.id]: e.target.value }))}
                                                      />
                                                    </div>
                                                    {priceEntered && (
                                                      <div className="space-y-1 rounded-lg border border-border bg-background p-2">
                                                        <label className="flex items-start gap-2 text-[11px]">
                                                          <input type="radio" className="mt-0.5" name={`price-scope-${l.id}`} checked={scope === 'all_stock'} onChange={() => setPriceScope((s) => ({ ...s, [l.id]: 'all_stock' }))} />
                                                          <span><span className="font-medium text-foreground">Update price for all stock</span> — applies immediately, including units already in stock.</span>
                                                        </label>
                                                        <label className="flex items-start gap-2 text-[11px]">
                                                          <input type="radio" className="mt-0.5" name={`price-scope-${l.id}`} checked={scope === 'new_stock_only'} onChange={() => setPriceScope((s) => ({ ...s, [l.id]: 'new_stock_only' }))} />
                                                          <span><span className="font-medium text-foreground">Only for new stock</span> — existing stock keeps selling at {currentPrice !== undefined ? currentPrice.toFixed(2) : 'its current price'} until it sells out, then the new price takes over automatically.</span>
                                                        </label>
                                                        {priceChanged && scope === 'all_stock' && (
                                                          <p className="text-amber-600">This changes the price of every unit of this item right away, including stock bought at the old cost.</p>
                                                        )}
                                                      </div>
                                                    )}
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
                                <Button type="submit" className="flex-1" disabled={create.isPending || receivingWarehouse.unresolved}>{create.isPending ? 'Creating…' : 'Create Receipt'}</Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
