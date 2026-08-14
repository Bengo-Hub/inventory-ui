'use client';

// Edit a DRAFT transfer's line items + header fields before it ships — the tool for correcting
// a transfer whose drafted quantities don't match physical stock, without cancelling and
// recreating the whole record. Source/destination warehouse are immutable (shown read-only for
// context); mirrors the New Transfer dialog's shape, reusing TransferItemsEditor for the items.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { X } from 'lucide-react';
import { useTransfer, useUpdateTransfer } from '@/hooks/useTransfers';
import { TransferItemsEditor, type TransferItemRow } from './transfer-items-editor';
import { apiErrorMessage } from '@/lib/api/error-message';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';

export function EditTransferDialog({ orgSlug, transferId, onClose }: { orgSlug: string; transferId: string; onClose: () => void }) {
    const { data: transfer, isLoading } = useTransfer(orgSlug, transferId);
    const updateTransfer = useUpdateTransfer(orgSlug);

    const [items, setItems] = useState<TransferItemRow[]>([]);
    const [notes, setNotes] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [carrier, setCarrier] = useState('');
    const [shippingCharges, setShippingCharges] = useState('');
    const [hydrated, setHydrated] = useState(false);

    // Prefill once the transfer loads — guarded so a background refetch (e.g. from another tab)
    // doesn't clobber in-progress edits.
    useEffect(() => {
        if (!transfer || hydrated) return;
        setItems((transfer.lines ?? []).map((l) => ({
            itemId: l.item_id,
            itemName: l.item_name || '',
            quantity: String(l.quantity),
        })));
        setNotes(transfer.notes ?? '');
        setReferenceNo(transfer.reference_no ?? '');
        setCarrier(transfer.carrier ?? '');
        setShippingCharges(transfer.shipping_charges ? String(transfer.shipping_charges) : '');
        setHydrated(true);
    }, [transfer, hydrated]);

    const canEdit = transfer?.status === 'draft';

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const validItems = items
            .filter((i) => i.itemId.trim() && parseFloat(i.quantity) > 0)
            .map((i) => ({ item_id: i.itemId.trim(), quantity: parseDecimal(i.quantity) }));

        if (validItems.length === 0) {
            toast.error('Add at least one item with a valid quantity');
            return;
        }

        updateTransfer.mutate({
            id: transferId,
            data: {
                notes: notes.trim() || undefined,
                reference_no: referenceNo.trim() || undefined,
                shipping_charges: parseDecimal(shippingCharges) > 0 ? parseDecimal(shippingCharges) : undefined,
                carrier: carrier.trim() || undefined,
                items: validItems,
            },
        }, {
            onSuccess: () => {
                toast.success('Transfer updated');
                onClose();
            },
            onError: async (err) => {
                toast.error(await apiErrorMessage(err, 'Failed to update transfer'));
            },
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-3xl max-h-[90vh] flex flex-col">
                <Card className="flex flex-col overflow-hidden max-h-[90vh]">
                    <CardHeader className="shrink-0">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Edit Transfer{transfer ? ` — ${transfer.transfer_number}` : ''}</h2>
                            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent className="overflow-y-auto flex-1">
                        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
                        {!isLoading && transfer && !canEdit && (
                            <p className="text-sm text-destructive">
                                This transfer is already {transfer.status.replace('_', ' ')} — it can no longer be amended. Cancel and
                                create a new one if the quantities still need correcting.
                            </p>
                        )}
                        {!isLoading && transfer && canEdit && (
                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <p className="text-muted-foreground text-xs">From Warehouse</p>
                                        <p className="font-medium">{transfer.source_warehouse?.name || '—'}</p>
                                    </div>
                                    <div>
                                        <p className="text-muted-foreground text-xs">To Warehouse</p>
                                        <p className="font-medium">{transfer.destination_warehouse?.name || '—'}</p>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Note</label>
                                    <Input
                                        placeholder="Optional note for this transfer..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Reference No.</label>
                                        <Input
                                            placeholder="Waybill / dispatch no."
                                            value={referenceNo}
                                            onChange={(e) => setReferenceNo(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Carrier</label>
                                        <Input
                                            placeholder="Courier / carrier"
                                            value={carrier}
                                            onChange={(e) => setCarrier(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Shipping Charges</label>
                                        <Input
                                            type="number"
                                            placeholder="0.00"
                                            min="0"
                                            step={DECIMAL_STEP}
                                            value={shippingCharges}
                                            onChange={(e) => setShippingCharges(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <TransferItemsEditor
                                    orgSlug={orgSlug}
                                    sourceWarehouseId={transfer.source_warehouse?.id ?? ''}
                                    items={items}
                                    onChange={setItems}
                                />

                                <div className="flex gap-3 pt-2">
                                    <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="flex-1" disabled={updateTransfer.isPending}>
                                        {updateTransfer.isPending ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
