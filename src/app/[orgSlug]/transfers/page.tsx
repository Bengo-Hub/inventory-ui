'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import {
    useTransfers,
    useCreateTransfer,
    useShipTransfer,
    useReceiveTransfer,
    useCancelTransfer,
    useTransfer,
} from '@/hooks/useTransfers';
import type { TransferSummary } from '@/lib/api/transfers';
import { useWarehouses } from '@/hooks/useWarehouses';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { WarehouseQuickCreateDialog } from '@/components/inventory/WarehouseQuickCreateDialog';
import { DetailDrawer } from '@/components/inventory/DetailDrawer';
import { RowActions } from '@/components/inventory/RowActions';
import { AlertTriangle, ArrowRightLeft, Package, Plus, Search, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    draft: 'outline',
    pending: 'outline',
    in_transit: 'warning',
    received: 'success',
    cancelled: 'error',
};

// UI vocabulary mirrors the standard stock-transfer lifecycle (Pending → In Transit → Completed).
// The API enum (draft/in_transit/received/cancelled) is unchanged — only the display labels map.
const STATUS_LABEL: Record<string, string> = {
    draft: 'Pending',
    pending: 'Pending',
    in_transit: 'In Transit',
    received: 'Completed',
    cancelled: 'Cancelled',
};

// Slide-over detail for a single transfer, replacing the old inline expand-row. Fetches the
// full transfer and surfaces ship/receive/cancel + the line table in a consistent DetailDrawer.
function TransferDetailDrawer({ orgSlug, transferId, onClose }: { orgSlug: string; transferId: string | null; onClose: () => void }) {
    const { data: transfer, isLoading } = useTransfer(orgSlug, transferId ?? '');
    const shipMutation = useShipTransfer(orgSlug);
    const receiveMutation = useReceiveTransfer(orgSlug);
    const cancelMutation = useCancelTransfer(orgSlug);

    function handleShip() {
        if (!transferId) return;
        shipMutation.mutate(transferId, {
            onSuccess: () => toast.success('Transfer shipped — status updated to In Transit'),
            onError: () => toast.error('Failed to ship transfer'),
        });
    }
    function handleReceive() {
        if (!transferId) return;
        receiveMutation.mutate({ id: transferId }, {
            onSuccess: () => { toast.success('Transfer received — stock levels updated'); onClose(); },
            onError: () => toast.error('Failed to receive transfer'),
        });
    }
    function handleCancel() {
        if (!transferId) return;
        if (!confirm('Cancel this transfer? This cannot be undone.')) return;
        cancelMutation.mutate(transferId, {
            onSuccess: () => { toast.success('Transfer cancelled'); onClose(); },
            onError: () => toast.error('Failed to cancel transfer'),
        });
    }

    const canShip = transfer?.status === 'draft';
    const canReceive = transfer?.status === 'in_transit';
    const canCancel = transfer?.status === 'draft' || transfer?.status === 'in_transit';
    const isBusy = shipMutation.isPending || receiveMutation.isPending || cancelMutation.isPending;

    return (
        <DetailDrawer
            open={!!transferId}
            onClose={onClose}
            loading={!!transferId && isLoading}
            title={transfer?.transfer_number ?? 'Stock Transfer'}
            subtitle={transfer ? `${transfer.source_warehouse?.name || '—'} → ${transfer.destination_warehouse?.name || '—'}` : undefined}
            badges={transfer && <Badge variant={STATUS_VARIANT[transfer.status] ?? 'default'}>{STATUS_LABEL[transfer.status] ?? transfer.status}</Badge>}
            fields={transfer ? [
                { label: 'From', value: transfer.source_warehouse?.name || '—' },
                { label: 'To', value: transfer.destination_warehouse?.name || '—' },
                { label: 'Reference', value: transfer.reference_no, hideIfEmpty: true },
                { label: 'Carrier', value: transfer.carrier, hideIfEmpty: true },
                { label: 'Shipping', value: (transfer.shipping_charges ?? 0) > 0 ? transfer.shipping_charges?.toLocaleString() : '—', hideIfEmpty: true },
                { label: 'Notes', value: transfer.notes, full: true, hideIfEmpty: true },
            ] : []}
            actions={transfer && (
                <>
                    {canShip && <Button size="sm" onClick={handleShip} disabled={isBusy}>Ship Transfer</Button>}
                    {canReceive && <Button size="sm" onClick={handleReceive} disabled={isBusy}>Mark Received</Button>}
                    {canCancel && (
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleCancel} disabled={isBusy}>Cancel Transfer</Button>
                    )}
                </>
            )}
        >
            {transfer && (transfer.lines?.length ?? 0) > 0 && (
                <div className="space-y-2">
                    <h3 className="text-sm font-semibold">Items</h3>
                    <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                                    {transfer.status === 'received' && (
                                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Received</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {transfer.lines!.map((line) => (
                                    <tr key={line.id}>
                                        <td className="px-3 py-2">
                                            <div className="font-medium">{line.item_name || '—'}</div>
                                            {line.item_sku && <div className="font-mono text-xs text-muted-foreground">{line.item_sku}</div>}
                                        </td>
                                        <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                                        {transfer.status === 'received' && (
                                            <td className="px-3 py-2 text-right tabular-nums">{line.received_qty ?? line.quantity}</td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </DetailDrawer>
    );
}

export default function TransfersPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [viewId, setViewId] = useState<string | null>(null);
    // Inline create-and-link: which warehouse picker (source/destination) requested a quick-create.
    const [addWarehouseFor, setAddWarehouseFor] = useState<'from' | 'to' | null>(null);

    const [fromWarehouse, setFromWarehouse] = useState('');
    const [toWarehouse, setToWarehouse] = useState('');
    const [note, setNote] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [shippingCharges, setShippingCharges] = useState('');
    const [carrier, setCarrier] = useState('');
    const [transferItems, setTransferItems] = useState<{ itemId: string; itemName: string; quantity: string; availableQty?: number }[]>([
        { itemId: '', itemName: '', quantity: '' },
    ]);

    const { data: transfers, isLoading, isError, refetch } = useTransfers(orgSlug);
    const { data: warehouses } = useWarehouses(orgSlug);
    const createTransfer = useCreateTransfer(orgSlug);

    const filtered = search
        ? transfers?.filter((t: TransferSummary) =>
            t.source_warehouse_name.toLowerCase().includes(search.toLowerCase()) ||
            t.destination_warehouse_name.toLowerCase().includes(search.toLowerCase()) ||
            t.transfer_number.toLowerCase().includes(search.toLowerCase())
          )
        : transfers;

    const totalPages = Math.max(1, Math.ceil((filtered?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = filtered?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    useMemo(() => { setPage(1); }, [search]);

    function openCreate() {
        setFromWarehouse('');
        setToWarehouse('');
        setNote('');
        setReferenceNo('');
        setShippingCharges('');
        setCarrier('');
        setTransferItems([{ itemId: '', itemName: '', quantity: '', availableQty: undefined }]);
        setDialogOpen(true);
    }

    function closeDialog() {
        setDialogOpen(false);
    }

    function addItem() {
        setTransferItems([...transferItems, { itemId: '', itemName: '', quantity: '' }]);
    }

    function removeItem(index: number) {
        setTransferItems(transferItems.filter((_, i) => i !== index));
    }

    function updateItem(index: number, field: 'itemId' | 'itemName' | 'quantity', value: string) {
        const updated = [...transferItems];
        updated[index] = { ...updated[index], [field]: value };
        setTransferItems(updated);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!fromWarehouse || !toWarehouse) {
            toast.error('Select source and destination warehouses');
            return;
        }
        if (fromWarehouse === toWarehouse) {
            toast.error('Source and destination must be different');
            return;
        }
        const validItems = transferItems
            .filter((i) => i.itemId.trim() && parseFloat(i.quantity) > 0)
            .map((i) => ({ item_id: i.itemId.trim(), quantity: parseFloat(i.quantity) }));

        if (validItems.length === 0) {
            toast.error('Add at least one item with a valid quantity');
            return;
        }

        createTransfer.mutate({
            source_warehouse_id: fromWarehouse,
            destination_warehouse_id: toWarehouse,
            notes: note.trim() || undefined,
            reference_no: referenceNo.trim() || undefined,
            shipping_charges: parseFloat(shippingCharges) > 0 ? parseFloat(shippingCharges) : undefined,
            carrier: carrier.trim() || undefined,
            items: validItems,
        }, {
            onSuccess: () => {
                toast.success('Transfer created');
                closeDialog();
            },
            onError: () => {
                toast.error('Failed to create transfer');
            },
        });
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Stock Transfers</h1>
                    <p className="text-muted-foreground mt-1">Move inventory between warehouses</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Transfer
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search transfers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Reference</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">From</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">To</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading transfers...
                                        </td>
                                    </tr>
                                ) : isError ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                                            <p className="text-muted-foreground">Couldn&apos;t load transfers</p>
                                            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                        </td>
                                    </tr>
                                ) : (filtered?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <ArrowRightLeft className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No transfers found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((transfer: TransferSummary) => (
                                        <tr
                                            key={transfer.id}
                                            className="hover:bg-accent/30 transition-colors cursor-pointer"
                                            onClick={() => setViewId(transfer.id)}
                                        >
                                            <td className="px-6 py-4 font-mono text-xs">{transfer.transfer_number}</td>
                                            <td className="px-6 py-4">{transfer.source_warehouse_name || '—'}</td>
                                            <td className="px-6 py-4">{transfer.destination_warehouse_name || '—'}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <Badge variant={STATUS_VARIANT[transfer.status] ?? 'default'}>
                                                        {STATUS_LABEL[transfer.status] ?? transfer.status}
                                                    </Badge>
                                                    <div className="flex items-center gap-1 text-muted-foreground text-xs">
                                                        <Package className="h-3 w-3" />
                                                        {transfer.line_count}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">
                                                {new Date(transfer.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <RowActions onView={() => setViewId(transfer.id)} />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (filtered?.length ?? 0) > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>

            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
                    <div className="relative z-50 w-full max-w-3xl max-h-[90vh] flex flex-col">
                        <Card className="flex flex-col overflow-hidden max-h-[90vh]">
                            <CardHeader className="shrink-0">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">New Stock Transfer</h2>
                                    <button onClick={closeDialog} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent className="overflow-y-auto flex-1">
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">From Warehouse *</label>
                                            <CreatableSelect
                                                value={fromWarehouse}
                                                onChange={setFromWarehouse}
                                                options={(warehouses ?? []).map((wh) => ({ id: wh.id, name: wh.name }))}
                                                placeholder="Select source..."
                                                required
                                                onAddClick={() => setAddWarehouseFor('from')}
                                                addLabel="Add warehouse"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">To Warehouse *</label>
                                            <CreatableSelect
                                                value={toWarehouse}
                                                onChange={setToWarehouse}
                                                options={(warehouses ?? []).map((wh) => ({ id: wh.id, name: wh.name }))}
                                                placeholder="Select destination..."
                                                required
                                                onAddClick={() => setAddWarehouseFor('to')}
                                                addLabel="Add warehouse"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Note</label>
                                        <Input
                                            placeholder="Optional note for this transfer..."
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
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
                                                step="any"
                                                value={shippingCharges}
                                                onChange={(e) => setShippingCharges(e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground">Posted as a freight expense in treasury on completion.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <label className="text-sm font-medium">Items *</label>
                                                <p className="text-xs text-muted-foreground mt-0.5">Search and select items to transfer, then enter quantities</p>
                                            </div>
                                            <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                                                <Plus className="h-3 w-3 mr-1" />
                                                Add Item
                                            </Button>
                                        </div>
                                        {transferItems.map((item, idx) => (
                                            <div key={idx} className="space-y-1">
                                                <div className="flex gap-2 items-start">
                                                    <div className="flex-1">
                                                        <ItemSearchInput
                                                            orgSlug={orgSlug}
                                                            value={item.itemName}
                                                            placeholder="Search item by name or SKU..."
                                                            fixedDropdown
                                                            onSelect={(found) => {
                                                                const updated = [...transferItems];
                                                                updated[idx] = {
                                                                    ...updated[idx],
                                                                    itemId: found.id,
                                                                    itemName: found.name,
                                                                    availableQty: found.available,
                                                                };
                                                                setTransferItems(updated);
                                                            }}
                                                        />
                                                    </div>
                                                    <div className="space-y-2 w-28 shrink-0">
                                                        <label className="text-sm font-medium">Qty</label>
                                                        <Input
                                                            type="number"
                                                            placeholder="0"
                                                            min="0"
                                                            step="any"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                        />
                                                    </div>
                                                    {transferItems.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removeItem(idx)}
                                                            className="p-1 rounded hover:bg-accent text-muted-foreground mt-7"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                                {item.availableQty !== undefined && (
                                                    <p className="text-xs text-muted-foreground pl-1">
                                                        Available in source warehouse: <span className="font-semibold text-foreground">{item.availableQty.toLocaleString()}</span>
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" className="flex-1" disabled={createTransfer.isPending}>
                                            {createTransfer.isPending ? 'Creating...' : 'Create Transfer'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {addWarehouseFor && (
                <WarehouseQuickCreateDialog
                    orgSlug={orgSlug}
                    onClose={() => setAddWarehouseFor(null)}
                    onCreated={(wh) => {
                        if (addWarehouseFor === 'from') setFromWarehouse(wh.id);
                        else setToWarehouse(wh.id);
                        setAddWarehouseFor(null);
                    }}
                />
            )}

            <TransferDetailDrawer orgSlug={orgSlug} transferId={viewId} onClose={() => setViewId(null)} />
        </div>
    );
}
