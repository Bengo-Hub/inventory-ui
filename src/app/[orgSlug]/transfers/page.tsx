'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import {
    useTransfers,
    useCreateTransfer,
    useShipTransfer,
    useCancelTransfer,
    useTransfer,
} from '@/hooks/useTransfers';
import type { TransferSummary } from '@/lib/api/transfers';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useCreateFromQuery } from '@/hooks/useCreateFromQuery';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { ActiveWarehousePicker } from '@/components/inventory/ActiveWarehousePicker';
import { WarehouseQuickCreateDialog } from '@/components/inventory/WarehouseQuickCreateDialog';
import { DetailDrawer } from '@/components/inventory/DetailDrawer';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { apiErrorMessage } from '@/lib/api/error-message';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { apiClient } from '@/lib/api/client';
import { downloadBlob } from '@/components/inventory/ExportDialogs';
import { DocFormatMenu, type DocFormat } from '@/components/inventory/DocFormatMenu';
import { buildTransferColumns, STATUS_VARIANT, STATUS_LABEL } from './transfers-columns';
import { TransferItemsEditor } from './transfer-items-editor';
import { EditTransferDialog } from './edit-transfer-dialog';
import { ReceiveTransferDialog } from './receive-transfer-dialog';
import { Plus, RefreshCw, Search, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';

// Slide-over detail for a single transfer, replacing the old inline expand-row. Fetches the
// full transfer and surfaces ship/receive/cancel + the line table in a consistent DetailDrawer.
function TransferDetailDrawer({ orgSlug, transferId, onClose, onEdit, onReceive }: { orgSlug: string; transferId: string | null; onClose: () => void; onEdit: (id: string) => void; onReceive: (id: string) => void }) {
    const { data: transfer, isLoading } = useTransfer(orgSlug, transferId ?? '');
    const shipMutation = useShipTransfer(orgSlug);
    const cancelMutation = useCancelTransfer(orgSlug);
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m) => toast.error(m) });

    function openTransferDoc(type: 'transfer_order' | 'delivery_note' | 'grn', title: string, format: DocFormat = 'pdf') {
        if (!transferId || !transfer) return;
        const url = `/api/v1/${orgSlug}/inventory/transfers/${transferId}/pdf`;
        if (format === 'pdf') {
            openPreview(
                () => apiClient.getBlob(url, { type, format }),
                { fileName: `${transfer.transfer_number}-${type}.pdf`, title: `${title} — ${transfer.transfer_number}` },
            );
            return;
        }
        apiClient
            .getBlob(url, { type, format })
            .then((blob) => downloadBlob(blob, `${transfer.transfer_number}-${type}.${format}`))
            .catch(() => toast.error(`Could not export ${title.toLowerCase()}. Please try again.`));
    }

    function handleShip() {
        if (!transferId) return;
        shipMutation.mutate(transferId, {
            onSuccess: () => toast.success('Transfer shipped — status updated to In Transit'),
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to ship transfer')),
        });
    }
    function handleCancel() {
        if (!transferId) return;
        if (!confirm('Cancel this transfer? This cannot be undone.')) return;
        cancelMutation.mutate(transferId, {
            onSuccess: () => { toast.success('Transfer cancelled'); onClose(); },
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to cancel transfer')),
        });
    }

    const canShip = transfer?.status === 'draft';
    const canReceive = transfer?.status === 'in_transit';
    const canCancel = transfer?.status === 'draft' || transfer?.status === 'in_transit';
    const isBusy = shipMutation.isPending || cancelMutation.isPending;

    return (
        <DetailDrawer
            open={!!transferId}
            onClose={onClose}
            loading={!!transferId && isLoading}
            title={transfer?.transfer_number ?? 'Stock Transfer'}
            subtitle={transfer ? `${transfer.source_warehouse?.name || '—'} → ${transfer.destination_warehouse?.name || '—'}` : undefined}
            badges={transfer && (
                <>
                    <Badge variant={STATUS_VARIANT[transfer.status] ?? 'default'}>{STATUS_LABEL[transfer.status] ?? transfer.status}</Badge>
                    {transfer.origin !== 'manual' && (
                        <span title="Auto-recorded from a bulk stock adjustment, not created via New Transfer">
                            <Badge variant="outline">Auto</Badge>
                        </span>
                    )}
                </>
            )}
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
                    {canShip && <Button size="sm" variant="outline" onClick={() => onEdit(transfer.id)} disabled={isBusy}>Edit</Button>}
                    {canShip && <Button size="sm" onClick={handleShip} disabled={isBusy}>Ship Transfer</Button>}
                    {canReceive && <Button size="sm" onClick={() => onReceive(transfer.id)} disabled={isBusy}>Mark Received</Button>}
                    {transfer.status === 'draft' && (
                        <DocFormatMenu label="Transfer Order" onSelect={(format) => openTransferDoc('transfer_order', 'Transfer Order', format)} />
                    )}
                    {(transfer.status === 'in_transit' || transfer.status === 'received') && (
                        <DocFormatMenu label="Delivery Note" onSelect={(format) => openTransferDoc('delivery_note', 'Delivery Note', format)} />
                    )}
                    {transfer.status === 'received' && (
                        <DocFormatMenu label="Goods Received Note" onSelect={(format) => openTransferDoc('grn', 'Goods Received Note', format)} />
                    )}
                    {canCancel && (
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" onClick={handleCancel} disabled={isBusy}>Cancel Transfer</Button>
                    )}
                </>
            )}
        >
            <PdfPreview {...previewProps} />
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
    const [range, setRange] = useState<DateRange>({ from: '', to: '' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [dialogOpen, setDialogOpen] = useState(false);
    useCreateFromQuery(() => setDialogOpen(true)); // mobile quick-add → open New Transfer
    const [viewId, setViewId] = useState<string | null>(null);
    const [receiveId, setReceiveId] = useState<string | null>(null);
    // Inline create-and-link: which warehouse picker (source/destination) requested a quick-create.
    const [addWarehouseFor, setAddWarehouseFor] = useState<'from' | 'to' | null>(null);

    // Source warehouse uses branch resolution (defaults to the active outlet; explicit pick
    // required under "All Outlets"). Destination stays an unscoped explicit pick.
    const sourceWarehouse = useActiveWarehouse(orgSlug);
    const [toWarehouse, setToWarehouse] = useState('');
    const [note, setNote] = useState('');
    const [referenceNo, setReferenceNo] = useState('');
    const [shippingCharges, setShippingCharges] = useState('');
    const [carrier, setCarrier] = useState('');
    const [transferItems, setTransferItems] = useState<{ itemId: string; itemName: string; quantity: string; availableQty?: number }[]>([
        { itemId: '', itemName: '', quantity: '' },
    ]);

    const { data: transfers, isLoading, isError, refetch, isFetching } = useTransfers(orgSlug, {
        from: range.from || undefined,
        to: range.to || undefined,
    });
    const { data: warehouses } = useWarehouses(orgSlug);
    const createTransfer = useCreateTransfer(orgSlug);

    const filtered = search
        ? transfers?.filter((t: TransferSummary) =>
            t.source_warehouse_name.toLowerCase().includes(search.toLowerCase()) ||
            t.destination_warehouse_name.toLowerCase().includes(search.toLowerCase()) ||
            t.transfer_number.toLowerCase().includes(search.toLowerCase())
          )
        : transfers;

    const totalPages = Math.max(1, Math.ceil((filtered?.length ?? 0) / pageSize));
    const paginatedItems = filtered?.slice((page - 1) * pageSize, page * pageSize) ?? [];

    useMemo(() => { setPage(1); }, [search, range, pageSize]);

    const columns = useMemo(
        () => buildTransferColumns({ onView: (t) => setViewId(t.id), onEdit: (t) => setEditId(t.id) }),
        [],
    );

    function openCreate() {
        sourceWarehouse.reset();
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

    const [editId, setEditId] = useState<string | null>(null);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (sourceWarehouse.unresolved) {
            toast.error('Select the source warehouse before submitting');
            return;
        }
        if (!sourceWarehouse.warehouseId || !toWarehouse) {
            toast.error('Select source and destination warehouses');
            return;
        }
        if (sourceWarehouse.warehouseId === toWarehouse) {
            toast.error('Source and destination must be different');
            return;
        }
        const validItems = transferItems
            .filter((i) => i.itemId.trim() && parseFloat(i.quantity) > 0)
            .map((i) => ({ item_id: i.itemId.trim(), quantity: parseDecimal(i.quantity) }));

        if (validItems.length === 0) {
            toast.error('Add at least one item with a valid quantity');
            return;
        }

        createTransfer.mutate({
            source_warehouse_id: sourceWarehouse.warehouseId,
            destination_warehouse_id: toWarehouse,
            notes: note.trim() || undefined,
            reference_no: referenceNo.trim() || undefined,
            shipping_charges: parseDecimal(shippingCharges) > 0 ? parseDecimal(shippingCharges) : undefined,
            carrier: carrier.trim() || undefined,
            items: validItems,
        }, {
            onSuccess: () => {
                toast.success('Transfer created');
                closeDialog();
            },
            onError: async (e) => {
                toast.error(await apiErrorMessage(e, 'Failed to create transfer'));
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
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isFetching}
                        onClick={() => refetch()}
                        title="Refresh — pulls in transfers dispatched/received elsewhere"
                    >
                        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button onClick={openCreate}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Transfer
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search transfers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <DateRangePicker value={range} onChange={setRange} className="w-56" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<TransferSummary>
                            columns={columns}
                            rows={paginatedItems}
                            rowKey={(t) => t.id}
                            loading={isLoading}
                            error={isError}
                            onRetry={() => refetch()}
                            onRowClick={(t) => setViewId(t.id)}
                            emptyText="No transfers found"
                            storageKey="transfers-col-prefs"
                            page={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            total={filtered?.length}
                            pageSize={pageSize}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
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
                                        <ActiveWarehousePicker
                                            active={sourceWarehouse}
                                            label="From Warehouse"
                                            required
                                            onAddNew={() => setAddWarehouseFor('from')}
                                        />
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
                                                step={DECIMAL_STEP}
                                                value={shippingCharges}
                                                onChange={(e) => setShippingCharges(e.target.value)}
                                            />
                                            <p className="text-xs text-muted-foreground">Posted as a freight expense in treasury on completion.</p>
                                        </div>
                                    </div>

                                    <TransferItemsEditor
                                        orgSlug={orgSlug}
                                        sourceWarehouseId={sourceWarehouse.warehouseId}
                                        items={transferItems}
                                        onChange={setTransferItems}
                                    />

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
                        if (addWarehouseFor === 'from') sourceWarehouse.setWarehouseId(wh.id);
                        else setToWarehouse(wh.id);
                        setAddWarehouseFor(null);
                    }}
                />
            )}

            <TransferDetailDrawer
                orgSlug={orgSlug}
                transferId={viewId}
                onClose={() => setViewId(null)}
                onEdit={(id) => { setViewId(null); setEditId(id); }}
                onReceive={(id) => { setViewId(null); setReceiveId(id); }}
            />
            {editId && (
                <EditTransferDialog orgSlug={orgSlug} transferId={editId} onClose={() => setEditId(null)} />
            )}
            {receiveId && (
                <ReceiveTransferDialog orgSlug={orgSlug} transferId={receiveId} onClose={() => setReceiveId(null)} />
            )}
        </div>
    );
}
