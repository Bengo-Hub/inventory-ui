'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { InfoHint } from '@/components/ui/info-hint';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { BarcodeScanButton } from '@/components/inventory/BarcodeScanner';
import { BulkAdjustStockDialog, type BulkAdjustStockItem } from '@/components/inventory/BulkAdjustStockDialog';
import { ADJUSTMENT_REASON_OPTIONS } from '@/lib/adjustment-reasons';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { WarehouseQuickCreateDialog } from '@/components/inventory/WarehouseQuickCreateDialog';
import { UnitQuickCreateDialog } from '@/components/inventory/UnitQuickCreateDialog';
import { ActiveWarehousePicker } from '@/components/inventory/ActiveWarehousePicker';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { useCreateAdjustment, useAdjustments } from '@/hooks/useStock';
import { useCreateFromQuery } from '@/hooks/useCreateFromQuery';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import { useUnits } from '@/hooks/useUnits';
import { FeatureLockBanner } from '@/components/subscription/feature-lock-banner';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildAdjustmentColumns } from './adjustments-columns';
import type { StockAdjustment } from '@/lib/api/stock';
import { searchItems, type Item } from '@/lib/api/items';
import { SearchAddTable, type SearchAddOption } from '@bengo-hub/shared-ui-lib/search-add-table';
import { Minus, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiErrorMessage } from '@/lib/api/error-message';
import { approvalGateFromError } from '@/lib/api/approvals';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { downloadBlob } from '@/components/inventory/ExportDialogs';
import type { DocFormat } from '@/components/inventory/DocFormatMenu';

interface ItemSearchOption extends SearchAddOption {
    item: Item;
}

/**
 * When a large adjustment is routed through the approval workflow the API returns a 422
 * with { approval_required: true }. Surface that as an informational message (not an error)
 * and report handled so callers skip the generic failure toast. Returns true if it was an
 * approval gate.
 */
function handleApprovalGate(e: unknown): boolean {
    const gate = approvalGateFromError(e);
    if (!gate) return false;
    toast.info(
        gate.state === 'pending' || gate.state === 'not_submitted'
            ? 'This adjustment is awaiting manager approval before it can post.'
            : gate.state === 'rejected'
                ? 'This adjustment was rejected by an approver and cannot post.'
                : 'This adjustment exceeds the approval threshold — a request has been sent for manager sign-off. It will post once approved.',
        { duration: 6000 },
    );
    return true;
}

const REASON_OPTIONS = ADJUSTMENT_REASON_OPTIONS;

interface AdjustmentModalProps {
    orgSlug: string;
    onClose: () => void;
    prefillSku?: string;
    prefillName?: string;
}

function AdjustmentModal({ orgSlug, onClose, prefillSku = '', prefillName = '' }: AdjustmentModalProps) {
    const [type, setType] = useState<'add' | 'remove'>('add');
    const [itemSku, setItemSku] = useState(prefillSku);
    const [itemName, setItemName] = useState(prefillName);
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [unitId, setUnitId] = useState('');

    // Branch resolution: default to the active outlet's warehouse; require an explicit pick
    // when "All Outlets" is selected (block submit while unresolved).
    const activeWarehouse = useActiveWarehouse(orgSlug);
    const { data: units } = useUnits(orgSlug);
    const mutation = useCreateAdjustment(orgSlug);

    const [addWarehouseOpen, setAddWarehouseOpen] = useState(false);
    const [addUnitOpen, setAddUnitOpen] = useState(false);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const qty = parseDecimal(quantity);
        if (!itemSku || isNaN(qty) || qty <= 0 || !reason) {
            toast.error('Please fill in all required fields');
            return;
        }
        if (activeWarehouse.unresolved) {
            toast.error('Select a warehouse for this adjustment before submitting');
            return;
        }

        // Send the enum VALUE (e.g. "correction"), not the human label — the API validates
        // reason against the stockadjustment enum and silently collapses unknown values to
        // "other". The human note travels in `notes`.
        mutation.mutate({
            sku: itemSku,
            adjustment: type === 'add' ? qty : -qty,
            reason,
            notes: notes.trim() || undefined,
            warehouse_id: activeWarehouse.warehouseId || undefined,
            unit_id: unitId || undefined,
        }, {
            onSuccess: () => {
                toast.success('Stock adjustment recorded');
                onClose();
            },
            onError: async (e) => {
                if (handleApprovalGate(e)) { onClose(); return; }
                toast.error(await apiErrorMessage(e, 'Failed to record adjustment'));
            },
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">New Stock Adjustment</h2>
                            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant={type === 'add' ? 'primary' : 'outline'}
                                    onClick={() => setType('add')}
                                    className="flex-1"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Stock
                                </Button>
                                <Button
                                    type="button"
                                    variant={type === 'remove' ? 'destructive' : 'outline'}
                                    onClick={() => setType('remove')}
                                    className="flex-1"
                                >
                                    <Minus className="h-4 w-4 mr-2" />
                                    Remove Stock
                                </Button>
                            </div>

                            <ItemSearchInput
                                orgSlug={orgSlug}
                                value={itemName}
                                label="Item *"
                                placeholder="Search by name or SKU..."
                                onSelect={(item) => {
                                    setItemSku(item.sku);
                                    setItemName(item.name);
                                    // Preselect the chosen item's unit of measure.
                                    setUnitId(item.unit_id ?? '');
                                }}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Quantity *</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        min="0"
                                        step={DECIMAL_STEP}
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Unit</label>
                                    <CreatableSelect
                                        value={unitId}
                                        onChange={setUnitId}
                                        options={(units ?? []).map((u) => ({ id: u.id, name: `${u.name}${u.abbreviation ? ` (${u.abbreviation})` : ''}` }))}
                                        placeholder="Base unit"
                                        onAddClick={() => setAddUnitOpen(true)}
                                        addLabel="Add unit"
                                    />
                                </div>
                            </div>

                            <ActiveWarehousePicker
                                active={activeWarehouse}
                                required
                                onAddNew={() => setAddWarehouseOpen(true)}
                            />

                            <div className="space-y-2">
                                <label className="text-sm font-medium inline-flex items-center gap-1">Reason *
                                    <InfoHint title="Why the count is changing">
                                        Sets the audit trail and reporting bucket. Use <strong>Initial Stock Count</strong> to load
                                        opening stock for a brand-new item, <strong>Count Correction</strong> after a stock take,
                                        and <strong>Damaged / Expired / Theft</strong> for write-offs (these may need manager approval
                                        above a configured amount).
                                    </InfoHint>
                                </label>
                                <select
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                >
                                    <option value="">Select reason...</option>
                                    {REASON_OPTIONS.map((r) => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            {reason === 'other' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Notes *</label>
                                    <textarea
                                        placeholder="Describe the reason for this adjustment..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        required
                                        rows={3}
                                        className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                                    />
                                </div>
                            )}

                            <div className="flex gap-3 pt-1">
                                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                                    Cancel
                                </Button>
                                <Button type="submit" className="flex-1" disabled={mutation.isPending || activeWarehouse.unresolved}>
                                    {mutation.isPending ? 'Recording...' : `Record ${type === 'add' ? 'Addition' : 'Removal'}`}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {addWarehouseOpen && (
                <WarehouseQuickCreateDialog
                    orgSlug={orgSlug}
                    onClose={() => setAddWarehouseOpen(false)}
                    onCreated={(wh) => { activeWarehouse.setWarehouseId(wh.id); setAddWarehouseOpen(false); }}
                />
            )}
            {addUnitOpen && (
                <UnitQuickCreateDialog
                    orgSlug={orgSlug}
                    onClose={() => setAddUnitOpen(false)}
                    onCreated={(u) => { setUnitId(u.id); setAddUnitOpen(false); }}
                />
            )}
        </div>
    );
}

export default function AdjustmentsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [range, setRange] = useState<DateRange>({ from: '', to: '' });
    const [page] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [showModal, setShowModal] = useState(false);
    const [prefillSku, setPrefillSku] = useState('');
    const [prefillName, setPrefillName] = useState('');
    // Bulk adjust: search-and-add items into a working list, then hand it to the shared
    // BulkAdjustStockDialog (same component the Products and Stock Levels pages open from their
    // own row selection — this page has no item list of its own to select from, only a history
    // of past adjustments, so it builds the list via search instead).
    const [bulkPickerOpen, setBulkPickerOpen] = useState(false);
    const [bulkItems, setBulkItems] = useState<BulkAdjustStockItem[]>([]);
    const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
    // Mobile quick-add + "Adjust Stock" deep-links from the catalog drawer land here with
    // ?create=1 (+ optional &sku=&name= to prefill the item).
    useCreateFromQuery(() => {
        const p = new URLSearchParams(window.location.search);
        openModal(p.get('sku') ?? '', p.get('name') ?? '');
    });

    const { canAny } = usePermissions();
    const canAdjust = canAny([P.ADJUSTMENTS_ADD, P.ADJUSTMENTS_MANAGE]);

    const { data: adjustments, isLoading, isError, refetch, isFetching } = useAdjustments(orgSlug, {
        date_from: range.from || undefined,
        date_to: range.to || undefined,
    });

    const filtered = useMemo(() => {
        if (!search) return adjustments;
        const q = search.toLowerCase();
        return adjustments?.filter((a) =>
            (a.item_name ?? '').toLowerCase().includes(q) ||
            (a.reason ?? '').toLowerCase().includes(q) ||
            (a.warehouse_name ?? '').toLowerCase().includes(q)
        );
    }, [adjustments, search]);

    const totalPages = Math.max(1, Math.ceil((filtered?.length ?? 0) / pageSize));
    const paginated = filtered?.slice((page - 1) * pageSize, page * pageSize) ?? [];

    // Document preview (Print/Export) — streams inventory-api's GET /adjustments/document?
    // reference=… . An adjustment isn't its own document (one audit-trail row per item/warehouse
    // movement); the printable "Stock Adjustment Note" groups every row sharing one reference
    // batch, so this reprints the whole batch from whichever row in it the operator clicked.
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function previewAdjustment(a: StockAdjustment, format: DocFormat = 'pdf') {
        if (!a.reference) return;
        const url = `/api/v1/${orgSlug}/inventory/adjustments/document`;
        if (format === 'pdf') {
            openPreview(() => apiClient.getBlob(url, { reference: a.reference, format }), { fileName: `${a.reference}.pdf`, title: a.reference });
            return;
        }
        apiClient.getBlob(url, { reference: a.reference, format })
            .then((blob) => downloadBlob(blob, `${a.reference}.${format}`))
            .catch(() => toast.error('Could not export stock adjustment. Please try again.'));
    }

    const columns = useMemo(() => buildAdjustmentColumns({ onPrint: (a, format) => previewAdjustment(a, format) }), []);

    function openModal(sku = '', name = '') {
        setPrefillSku(sku);
        setPrefillName(name);
        setShowModal(true);
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Stock Adjustments</h1>
                    <p className="text-muted-foreground mt-1">Add or remove stock manually</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isFetching}
                        onClick={() => refetch()}
                        title="Refresh — pulls in adjustments made elsewhere"
                    >
                        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                    {canAdjust && (
                        <>
                            <Button variant="outline" onClick={() => { setBulkItems([]); setBulkPickerOpen(true); }}>
                                <Plus className="h-4 w-4 mr-2" />
                                Bulk Adjust
                            </Button>
                            <Button onClick={() => openModal()}>
                                <Plus className="h-4 w-4 mr-2" />
                                New Adjustment
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Non-hiding upgrade blocker: keeps the page + button visible, explains the lock. */}
            <FeatureLockBanner feature="stock_tracking" />

            <Card>
                <CardHeader className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by item, reason, or warehouse..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <DateRangePicker value={range} onChange={setRange} className="w-56 sm:w-56" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<StockAdjustment>
                            columns={columns}
                            rows={paginated}
                            rowKey={(a) => a.id}
                            loading={isLoading}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyText="No adjustments recorded yet"
                            storageKey="adjustments-col-prefs"
                            pageSize={pageSize}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
                    {!isLoading && totalPages > 1 && (
                        <div className="px-6 py-3 text-xs text-muted-foreground border-t border-border">
                            {filtered?.length ?? 0} adjustments
                        </div>
                    )}
                </CardContent>
            </Card>

            {showModal && (
                <AdjustmentModal
                    orgSlug={orgSlug}
                    onClose={() => setShowModal(false)}
                    prefillSku={prefillSku}
                    prefillName={prefillName}
                />
            )}

            {bulkPickerOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setBulkPickerOpen(false)} />
                    <Card className="relative z-50 w-full max-w-md">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">Bulk Adjust — pick items</h2>
                                <button onClick={() => setBulkPickerOpen(false)} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                    <X className="h-5 w-5 text-muted-foreground" />
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <SearchAddTable<ItemSearchOption>
                                onSearch={async (q) => (await searchItems(orgSlug, q))
                                    .map((it) => ({ id: it.id, label: it.name, hint: it.sku, item: it }))}
                                onAdd={(opt) => {
                                    if (bulkItems.some((i) => i.sku === opt.item.sku)) return;
                                    setBulkItems((prev) => [...prev, { sku: opt.item.sku, name: opt.item.name }]);
                                }}
                                placeholder="Search items to add..."
                                endAdornment={({ setQuery }) => (
                                    <BarcodeScanButton
                                        title="Scan item barcode"
                                        hint="Point the camera at the item barcode."
                                        className="h-8 w-8 rounded-lg"
                                        onScan={(code) => setQuery(code)}
                                    />
                                )}
                            />
                            {bulkItems.length > 0 && (
                                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                                    {bulkItems.map((item) => (
                                        <div key={item.sku} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                                            <span className="truncate">{item.name}</span>
                                            <button
                                                type="button"
                                                onClick={() => setBulkItems((prev) => prev.filter((i) => i.sku !== item.sku))}
                                                className="p-0.5 rounded hover:bg-muted-foreground/20 shrink-0"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" className="flex-1" onClick={() => setBulkPickerOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    type="button"
                                    className="flex-1"
                                    disabled={bulkItems.length === 0}
                                    onClick={() => { setBulkPickerOpen(false); setBulkDialogOpen(true); }}
                                >
                                    Continue ({bulkItems.length})
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {bulkDialogOpen && (
                <BulkAdjustStockDialog
                    orgSlug={orgSlug}
                    items={bulkItems}
                    onClose={() => setBulkDialogOpen(false)}
                    onDone={() => setBulkItems([])}
                />
            )}

            <PdfPreview {...previewProps} />
        </div>
    );
}
