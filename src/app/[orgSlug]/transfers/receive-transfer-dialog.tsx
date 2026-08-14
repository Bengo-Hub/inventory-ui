'use client';

// Confirm receipt of an in-transit transfer, with an optional per-line quantity override for
// when what actually arrived falls short of what was shipped (breakage/loss in transit, a
// miscount at dispatch). Defaults every line to the full shipped quantity — confirming with no
// changes behaves exactly like the old one-click "Mark Received".

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { X } from 'lucide-react';
import { useTransfer, useReceiveTransfer } from '@/hooks/useTransfers';
import { apiErrorMessage } from '@/lib/api/error-message';
import { parseDecimal } from '@/lib/utils';

// Subset of the platform's shared stock-adjustment reason vocabulary that plausibly explains a
// shortfall between what was shipped and what arrived (see stocktransferline.go's
// variance_reason comment for why this matches, not duplicates, that vocabulary).
const SHORTFALL_REASONS = [
    { value: 'damaged', label: 'Damaged in transit' },
    { value: 'expired', label: 'Expired / spoiled' },
    { value: 'shrinkage', label: 'Lost / unaccounted for' },
    { value: 'other', label: 'Other' },
];

export function ReceiveTransferDialog({ orgSlug, transferId, onClose }: { orgSlug: string; transferId: string; onClose: () => void }) {
    const { data: transfer, isLoading } = useTransfer(orgSlug, transferId);
    const receiveTransfer = useReceiveTransfer(orgSlug);

    const [qtyByLine, setQtyByLine] = useState<Record<string, string>>({});
    const [reasonByLine, setReasonByLine] = useState<Record<string, string>>({});
    const [hydrated, setHydrated] = useState(false);

    useEffect(() => {
        if (!transfer || hydrated) return;
        const qty: Record<string, string> = {};
        for (const l of transfer.lines ?? []) qty[l.id] = String(l.quantity);
        setQtyByLine(qty);
        setHydrated(true);
    }, [transfer, hydrated]);

    const canReceive = transfer?.status === 'in_transit';

    function handleConfirm() {
        const lines = transfer?.lines ?? [];
        const items: { item_id: string; line_id: string; received_qty: number; variance_reason?: string }[] = [];
        for (const l of lines) {
            const qty = parseDecimal(qtyByLine[l.id] ?? String(l.quantity));
            if (qty < 0 || qty > l.quantity) {
                toast.error(`Received quantity for ${l.item_name || 'an item'} must be between 0 and ${l.quantity}`);
                return;
            }
            items.push({
                item_id: l.item_id,
                line_id: l.id,
                received_qty: qty,
                variance_reason: qty < l.quantity ? (reasonByLine[l.id] || 'other') : undefined,
            });
        }

        receiveTransfer.mutate({ id: transferId, items }, {
            onSuccess: () => {
                toast.success('Transfer received — stock levels updated');
                onClose();
            },
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to receive transfer')),
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-2xl max-h-[90vh] flex flex-col">
                <Card className="flex flex-col overflow-hidden max-h-[90vh]">
                    <CardHeader className="shrink-0">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Receive Transfer{transfer ? ` — ${transfer.transfer_number}` : ''}</h2>
                            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent className="overflow-y-auto flex-1 space-y-4">
                        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                        {!isLoading && transfer && !canReceive && (
                            <p className="text-sm text-destructive">This transfer is {transfer.status.replace('_', ' ')} — it can't be received.</p>
                        )}
                        {!isLoading && transfer && canReceive && (
                            <>
                                <p className="text-xs text-muted-foreground">
                                    Confirm what actually arrived at {transfer.destination_warehouse?.name || 'the destination'}. Leave a
                                    quantity as-is if it matches what was shipped.
                                </p>
                                <div className="space-y-3">
                                    {(transfer.lines ?? []).map((l) => {
                                        const qty = parseDecimal(qtyByLine[l.id] ?? String(l.quantity));
                                        const short = qty < l.quantity;
                                        return (
                                            <div key={l.id} className="border border-border rounded-lg p-3 space-y-2">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <div className="font-medium text-sm">{l.item_name || '—'}</div>
                                                        {l.item_sku && <div className="font-mono text-xs text-muted-foreground">{l.item_sku}</div>}
                                                        <div className="text-xs text-muted-foreground">Shipped: {l.quantity}</div>
                                                    </div>
                                                    <div className="w-28 shrink-0 space-y-1">
                                                        <label className="text-xs font-medium">Received</label>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            max={l.quantity}
                                                            value={qtyByLine[l.id] ?? String(l.quantity)}
                                                            onChange={(e) => setQtyByLine((prev) => ({ ...prev, [l.id]: e.target.value }))}
                                                        />
                                                    </div>
                                                </div>
                                                {short && (
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-medium text-amber-600">Reason for shortfall</label>
                                                        <select
                                                            value={reasonByLine[l.id] ?? 'other'}
                                                            onChange={(e) => setReasonByLine((prev) => ({ ...prev, [l.id]: e.target.value }))}
                                                            className="w-full bg-background border border-border rounded-md py-1.5 px-2 text-sm"
                                                        >
                                                            {SHORTFALL_REASONS.map((r) => (
                                                                <option key={r.value} value={r.value}>{r.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex gap-3 pt-2">
                                    <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                                        Cancel
                                    </Button>
                                    <Button type="button" className="flex-1" disabled={receiveTransfer.isPending} onClick={handleConfirm}>
                                        {receiveTransfer.isPending ? 'Confirming...' : 'Confirm Receipt'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
