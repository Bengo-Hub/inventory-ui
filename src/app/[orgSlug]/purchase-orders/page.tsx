'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { ItemSearchInput, type ItemResult } from '@/components/inventory/ItemSearchInput';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { SupplierFormDialog } from '@/components/inventory/SupplierFormDialog';
import { WarehouseQuickCreateDialog } from '@/components/inventory/WarehouseQuickCreateDialog';
import { ActiveWarehousePicker } from '@/components/inventory/ActiveWarehousePicker';
import { ThreeWayMatchPanel } from '@/components/inventory/ThreeWayMatchPanel';
import { DetailDrawer } from '@/components/inventory/DetailDrawer';
import { RowActions } from '@/components/inventory/RowActions';
import {
    usePurchaseOrders,
    usePurchaseOrder,
    useCreatePurchaseOrder,
    useAmendPurchaseOrder,
    useSendPurchaseOrder,
    useReceivePurchaseOrder,
    useCancelPurchaseOrder,
} from '@/hooks/usePurchaseOrders';
import type { PurchaseOrder, POStatus } from '@/lib/api/purchase-orders';
import { useSuppliers, useCreateSupplier } from '@/hooks/useSuppliers';
import { useUnits } from '@/hooks/useUnits';
import { normalizeUnit, costPerBaseUnit } from '@/lib/units/convert';
import type { Unit } from '@/lib/api/units';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import { useApprovalForObject, useSubmitPurchaseOrderForApproval } from '@/hooks/useApprovals';
import { AlertTriangle, BarChart3, FileText, Minus, Plus, Printer, Search, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiClient } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/api/error-message';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';

const ITEMS_PER_PAGE = 20;

interface POLine {
    itemId: string;
    itemName: string;
    quantity: string;
    unitPrice: string;
    unitId: string;
    // Cost basis retained from the selected item so unitPrice can be RECOMPUTED whenever
    // the line's unit changes — e.g. an item costed at 500/kg must become 0.5 when the
    // line unit is switched to "g", not keep showing 500 against the wrong unit.
    costBasis?: {
        costPrice: number | null;
        purchasePrice: number | null;
        purchasePackSize: number | null;
        purchaseUnit: string | null;
        itemUnitId: string | null;
    };
}

// Default the line's unit to the item's purchase_unit (how it's actually bought — e.g. "kg"),
// matched against the tenant's units list by abbreviation/name; falls back to the item's stock
// unit_id (same convention RecipeIngredientRow/adjustments use) when no purchase_unit match exists.
function resolveDefaultUnitId(item: ItemResult, units: Unit[]): string {
    if (item.purchase_unit) {
        const norm = normalizeUnit(item.purchase_unit);
        const match = units.find((u) => normalizeUnit(u.abbreviation) === norm || normalizeUnit(u.name) === norm);
        if (match) return match.id;
    }
    if (item.unit_id && units.some((u) => u.id === item.unit_id)) return item.unit_id;
    return '';
}

// Auto-fill the line's unit price from the item's known cost: prefer purchase_price (the price
// actually paid per purchase_unit — "how it's bought"), falling back to cost_price (the derived
// per-base-unit EP cost) when no purchase price is on file. Mirrors RecipeIngredientRow's
// hasPack preference. The user can still edit the field afterwards — this only seeds it.
function resolveDefaultUnitPrice(item: ItemResult): string {
    if (item.purchase_price != null) return String(item.purchase_price);
    if (item.cost_price != null) return String(item.cost_price);
    return '';
}

/** Look up a unit's abbreviation (falling back to its name) from its id. */
function unitAbbr(unitId: string | undefined | null, units: Unit[]): string {
    if (!unitId) return '';
    const u = units.find((x) => x.id === unitId);
    return u ? (u.abbreviation || u.name) : '';
}

/**
 * Compute the line's unit price FOR THE GIVEN TARGET UNIT — the piece resolveDefaultUnitPrice was
 * missing: a price on file is only ever correct against the unit it was quoted in (purchase_unit
 * for purchase_price, the item's own stock unit for cost_price). Whenever the PO line's unit
 * differs, the price must be rescaled via costPerBaseUnit, not copied as-is (e.g. 500/kg shown
 * unchanged against a line switched to "g" would be a 1000x overcharge).
 */
function computeUnitPriceForUnit(item: ItemResult, targetUnitAbbr: string, units: Unit[]): string {
    const itemBaseAbbr = unitAbbr(item.unit_id, units);
    if (item.purchase_price != null) {
        const basisUnit = item.purchase_unit || itemBaseAbbr;
        const derived = costPerBaseUnit(item.purchase_price, item.purchase_pack_size, basisUnit, targetUnitAbbr || basisUnit);
        if (derived != null) return String(derived);
    }
    if (item.cost_price != null) {
        const derived = costPerBaseUnit(item.cost_price, 1, itemBaseAbbr, targetUnitAbbr || itemBaseAbbr);
        if (derived != null) return String(derived);
    }
    return resolveDefaultUnitPrice(item);
}

/** Recompute a line's unitPrice for a newly selected unit, using its retained cost basis. */
function recalcUnitPriceForNewUnit(line: POLine, newUnitId: string, units: Unit[]): string {
    if (!line.costBasis) return line.unitPrice;
    const cb = line.costBasis;
    const pseudoItem: ItemResult = {
        id: line.itemId, sku: '', name: line.itemName,
        cost_price: cb.costPrice, purchase_price: cb.purchasePrice,
        purchase_pack_size: cb.purchasePackSize, purchase_unit: cb.purchaseUnit ?? undefined,
        unit_id: cb.itemUnitId ?? undefined,
    };
    return computeUnitPriceForUnit(pseudoItem, unitAbbr(newUnitId, units), units);
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    draft: 'outline',
    sent: 'default',
    partially_received: 'warning',
    received: 'success',
    cancelled: 'error',
};

const STATUS_LABEL: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    partially_received: 'Partial',
    received: 'Received',
    cancelled: 'Cancelled',
};

export default function PurchaseOrdersPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [selectedPO, setSelectedPO] = useState<string | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [amendingId, setAmendingId] = useState<string | null>(null);

    const [supplierId, setSupplierId] = useState('');
    const [expectedDate, setExpectedDate] = useState('');
    const [poNotes, setPoNotes] = useState('');
    const [payTermDays, setPayTermDays] = useState('');
    const [additionalShipping, setAdditionalShipping] = useState('');
    const [poLines, setPoLines] = useState<POLine[]>([{ itemId: '', itemName: '', quantity: '', unitPrice: '', unitId: '' }]);

    const { data: suppliersPage } = useSuppliers(orgSlug);
    const { data: units } = useUnits(orgSlug);
    const suppliers = suppliersPage?.data;
    // Branch resolution: PO posts stock into a warehouse — default to the active outlet's,
    // require an explicit pick under "All Outlets". Amend overrides via setWarehouseId below.
    const activeWarehouse = useActiveWarehouse(orgSlug);
    const createSupplier = useCreateSupplier(orgSlug);
    const [addSupplierOpen, setAddSupplierOpen] = useState(false);
    const [addWarehouseOpen, setAddWarehouseOpen] = useState(false);
    const { data, isLoading, isError, refetch } = usePurchaseOrders(orgSlug, {
        search: search || undefined,
        status: (statusFilter || undefined) as POStatus | undefined,
        page,
        limit: ITEMS_PER_PAGE,
    });
    const orders = data?.data;
    const { data: poDetail } = usePurchaseOrder(orgSlug, selectedPO ?? '');
    const createPO = useCreatePurchaseOrder(orgSlug);
    const amendPO = useAmendPurchaseOrder(orgSlug);
    const sendPO = useSendPurchaseOrder(orgSlug);
    const receivePO = useReceivePurchaseOrder(orgSlug);
    const cancelPO = useCancelPurchaseOrder(orgSlug);
    const { data: poApproval } = useApprovalForObject(orgSlug, selectedPO ?? undefined);
    const submitForApproval = useSubmitPurchaseOrderForApproval(orgSlug);

    const { canAny } = usePermissions();
    const canCreate = canAny([P.PURCHASES_ADD, P.PURCHASES_MANAGE]);
    const canChangePO = canAny([P.PURCHASES_CHANGE, P.PURCHASES_MANAGE]);
    const canCancelPO = canAny([P.PURCHASES_DELETE, P.PURCHASES_MANAGE]);

    // Document preview (Print/Export) — reuses the shared-ui-lib PDF previewer (same as treasury-ui),
    // streaming the PO PDF from inventory-api's GET /purchase-orders/{id}/pdf.
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function previewPO(po: PurchaseOrder) {
        openPreview(
            () => apiClient.getBlob(`/api/v1/${orgSlug}/inventory/purchase-orders/${po.id}/pdf`),
            { fileName: `${po.po_number}.pdf`, title: po.po_number },
        );
    }

    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = orders ?? [];

    useMemo(() => { setPage(1); }, [search, statusFilter]);

    function addPOLine() {
        setPoLines([...poLines, { itemId: '', itemName: '', quantity: '', unitPrice: '', unitId: '' }]);
    }

    function removePOLine(idx: number) {
        setPoLines(poLines.filter((_, i) => i !== idx));
    }

    function updatePOLine(idx: number, field: keyof POLine, value: string) {
        const updated = [...poLines];
        updated[idx] = { ...updated[idx], [field]: value };
        setPoLines(updated);
    }

    function resetPOForm() {
        setSupplierId('');
        activeWarehouse.reset();
        setExpectedDate('');
        setPoNotes('');
        setPayTermDays('');
        setAdditionalShipping('');
        setPoLines([{ itemId: '', itemName: '', quantity: '', unitPrice: '', unitId: '' }]);
    }

    function closePODialog() {
        setCreateOpen(false);
        setAmendingId(null);
        resetPOForm();
    }

    function startCreate() {
        setAmendingId(null);
        resetPOForm();
        setCreateOpen(true);
    }

    // startAmend pre-fills the create dialog with an existing PO's lines and switches the
    // submit path to /amend. Amend replaces ALL lines server-side, so we seed every line.
    function startAmend(po: PurchaseOrder) {
        setSelectedPO(null); // leave the detail view; the dialog lives in the list view
        setAmendingId(po.id);
        setSupplierId(po.supplier_id);
        activeWarehouse.setWarehouseId(po.warehouse_id);
        setExpectedDate(po.expected_date ? po.expected_date.slice(0, 10) : '');
        setPoNotes(po.notes ?? '');
        setPayTermDays(po.pay_term_days != null ? String(po.pay_term_days) : '');
        setAdditionalShipping((po.additional_shipping_charges ?? 0) > 0 ? String(po.additional_shipping_charges) : '');
        setPoLines(
            (po.line_items ?? []).map((li) => ({
                itemId: li.item_id,
                itemName: li.item_name ?? '',
                quantity: String(li.quantity),
                unitPrice: String(li.unit_cost),
                unitId: li.unit_id ?? '',
            }))
        );
        if ((po.line_items?.length ?? 0) === 0) {
            setPoLines([{ itemId: '', itemName: '', quantity: '', unitPrice: '', unitId: '' }]);
        }
        setCreateOpen(true);
    }

    function handlePOSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!supplierId) { toast.error('Select a supplier'); return; }
        if (!activeWarehouse.warehouseId || activeWarehouse.unresolved) { toast.error('Select a warehouse'); return; }
        const lines = poLines
            .filter((l) => l.itemId && parseFloat(l.quantity) > 0)
            .map((l) => ({
                item_id: l.itemId,
                quantity: parseDecimal(l.quantity),
                unit_cost: parseDecimal(l.unitPrice),
                unit_id: l.unitId || undefined,
            }));
        if (lines.length === 0) { toast.error('Add at least one item'); return; }

        const payload = {
            supplier_id: supplierId,
            warehouse_id: activeWarehouse.warehouseId,
            expected_date: expectedDate || undefined,
            notes: poNotes.trim() || undefined,
            pay_term_days: parseInt(payTermDays) > 0 ? parseInt(payTermDays) : undefined,
            additional_shipping_charges: parseDecimal(additionalShipping) > 0 ? parseDecimal(additionalShipping) : undefined,
            line_items: lines,
        };

        if (amendingId) {
            amendPO.mutate({ id: amendingId, data: payload }, {
                onSuccess: () => { toast.success('Purchase order amended'); closePODialog(); },
                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to amend purchase order')),
            });
            return;
        }

        createPO.mutate(payload, {
            onSuccess: () => { toast.success('Purchase order created'); closePODialog(); },
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create purchase order')),
        });
    }

    // Drawer action gating — derived when a PO is selected.
    const isPOBusy = sendPO.isPending || receivePO.isPending || cancelPO.isPending;
    const dStatus = poDetail?.status;
    const canSend = canChangePO && dStatus === 'draft';
    const canReceive = canChangePO && (dStatus === 'sent' || dStatus === 'partially_received' || dStatus === 'draft');
    const canCancel = canCancelPO && (dStatus === 'draft' || dStatus === 'sent');
    // Amend is allowed only before goods start arriving (draft or sent) — it replaces all lines.
    const canAmend = canChangePO && (dStatus === 'draft' || dStatus === 'sent');
    // Approval-matrix awareness: offer "Submit for Approval" on drafts that have not
    // already entered (or cleared) an approval workflow.
    const approvalStatus = poApproval?.status;
    const showSubmit = canChangePO && dStatus === 'draft' && approvalStatus !== 'pending' && approvalStatus !== 'approved';

    return (
        <>
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
                    <p className="text-muted-foreground mt-1">Track orders from your suppliers</p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/${orgSlug}/purchase-orders/analytics`}><Button variant="outline"><BarChart3 className="h-4 w-4 mr-2" /> Analytics</Button></Link>
                    {canCreate && (
                        <Button onClick={startCreate}>
                            <Plus className="h-4 w-4 mr-2" />
                            New Order
                        </Button>
                    )}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by PO number or supplier..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="rounded-md border border-input bg-background px-3 py-2 text-sm sm:w-52"
                            aria-label="Filter by status"
                        >
                            <option value="">All statuses</option>
                            <option value="draft">Draft (incl. auto-reorder)</option>
                            <option value="sent">Sent</option>
                            <option value="partially_received">Partially received</option>
                            <option value="received">Received</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">PO Number</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Supplier</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Total</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading purchase orders...
                                        </td>
                                    </tr>
                                ) : isError ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                                            <p className="text-muted-foreground">Couldn&apos;t load purchase orders</p>
                                            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                        </td>
                                    </tr>
                                ) : paginatedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No purchase orders found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((po) => (
                                        <tr
                                            key={po.id}
                                            className="hover:bg-accent/30 transition-colors cursor-pointer"
                                            onClick={() => setSelectedPO(po.id)}
                                        >
                                            <td className="px-6 py-4 font-mono text-xs font-medium">{po.po_number}</td>
                                            <td className="px-6 py-4">{po.supplier_name}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={STATUS_VARIANT[po.status] ?? 'default'}>
                                                    {STATUS_LABEL[po.status] ?? po.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right font-semibold tabular-nums hidden sm:table-cell">
                                                {po.total_amount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">
                                                {new Date(po.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <RowActions
                                                    onView={() => setSelectedPO(po.id)}
                                                    onPrint={() => previewPO(po)}
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && paginatedItems.length > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>
        </div>

        {createOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closePODialog} />
                <div className="relative z-50 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <h2 className="text-lg font-semibold">{amendingId ? 'Amend Purchase Order' : 'New Purchase Order'}</h2>
                                <button
                                    onClick={closePODialog}
                                    className="p-1 rounded-lg hover:bg-accent transition-colors"
                                >
                                    <X className="h-5 w-5 text-muted-foreground" />
                                </button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handlePOSubmit} className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Supplier *</label>
                                        <CreatableSelect
                                            value={supplierId}
                                            onChange={setSupplierId}
                                            options={(suppliers ?? []).map((s) => ({ id: s.id, name: s.name }))}
                                            placeholder="Select supplier..."
                                            required
                                            onAddClick={() => setAddSupplierOpen(true)}
                                            addLabel="Add supplier"
                                        />
                                    </div>
                                    <ActiveWarehousePicker
                                        active={activeWarehouse}
                                        required
                                        onAddNew={() => setAddWarehouseOpen(true)}
                                    />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Expected Delivery</label>
                                        <Input
                                            type="date"
                                            value={expectedDate}
                                            onChange={(e) => setExpectedDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Pay Term (days)</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            placeholder="30"
                                            value={payTermDays}
                                            onChange={(e) => setPayTermDays(e.target.value)}
                                        />
                                        <p className="text-xs text-muted-foreground">Supplier bill due date = receipt + pay term.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Additional Shipping</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step={DECIMAL_STEP}
                                            placeholder="0.00"
                                            value={additionalShipping}
                                            onChange={(e) => setAdditionalShipping(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">Line Items *</label>
                                        <Button type="button" variant="ghost" size="sm" onClick={addPOLine}>
                                            <Plus className="h-3 w-3 mr-1" />
                                            Add Line
                                        </Button>
                                    </div>
                                    {poLines.map((line, idx) => (
                                        <div key={idx} className="space-y-2 p-3 rounded-lg border border-border">
                                            <ItemSearchInput
                                                orgSlug={orgSlug}
                                                value={line.itemName}
                                                // Purchase orders restock stock-tracked items — exclude RECIPE/menu
                                                // items so e.g. "Beef" the raw ingredient isn't buried under a dozen
                                                // "Beef ..." menu items that can't actually be purchased as stock.
                                                type="GOODS,INGREDIENT"
                                                onSelect={(item) => {
                                                    const updated = [...poLines];
                                                    const defaultUnitId = resolveDefaultUnitId(item, units ?? []);
                                                    updated[idx] = {
                                                        ...updated[idx],
                                                        itemId: item.id,
                                                        itemName: item.name,
                                                        // Auto-fill from the picked item; all remain editable below.
                                                        unitId: defaultUnitId,
                                                        unitPrice: computeUnitPriceForUnit(item, unitAbbr(defaultUnitId, units ?? []), units ?? []),
                                                        quantity: item.reorder_quantity ? String(item.reorder_quantity) : updated[idx].quantity,
                                                        // Retained so switching the unit below rescales the price instead of
                                                        // leaving it quoted against the wrong unit.
                                                        costBasis: {
                                                            costPrice: item.cost_price ?? null,
                                                            purchasePrice: item.purchase_price ?? null,
                                                            purchasePackSize: item.purchase_pack_size ?? null,
                                                            purchaseUnit: item.purchase_unit ?? null,
                                                            itemUnitId: item.unit_id ?? null,
                                                        },
                                                    };
                                                    setPoLines(updated);
                                                }}
                                                placeholder="Search item..."
                                            />
                                            <div className="grid grid-cols-4 gap-2 items-center">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Qty</label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step={DECIMAL_STEP}
                                                        placeholder="1"
                                                        value={line.quantity}
                                                        onChange={(e) => updatePOLine(idx, 'quantity', e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Unit</label>
                                                    <select
                                                        value={line.unitId}
                                                        onChange={(e) => {
                                                            const newUnitId = e.target.value;
                                                            const updated = [...poLines];
                                                            updated[idx] = {
                                                                ...updated[idx],
                                                                unitId: newUnitId,
                                                                // Rescale the price for the newly selected unit — see
                                                                // recalcUnitPriceForNewUnit / computeUnitPriceForUnit above.
                                                                unitPrice: recalcUnitPriceForNewUnit(updated[idx], newUnitId, units ?? []),
                                                            };
                                                            setPoLines(updated);
                                                        }}
                                                        className="w-full rounded-lg border border-input bg-transparent px-2 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                                        aria-label="Unit"
                                                    >
                                                        <option value="">Unit</option>
                                                        {(units ?? []).map((u) => (
                                                            <option key={u.id} value={u.id}>{u.abbreviation || u.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Unit Cost</label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step={DECIMAL_STEP}
                                                        placeholder="0.00"
                                                        value={line.unitPrice}
                                                        onChange={(e) => updatePOLine(idx, 'unitPrice', e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex items-end pb-0.5">
                                                    {poLines.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => removePOLine(idx)}
                                                        >
                                                            <Minus className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Notes</label>
                                    <textarea
                                        placeholder="Optional notes..."
                                        value={poNotes}
                                        onChange={(e) => setPoNotes(e.target.value)}
                                        rows={2}
                                        className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="flex-1"
                                        onClick={closePODialog}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" className="flex-1" disabled={createPO.isPending || amendPO.isPending}>
                                        {amendingId
                                            ? (amendPO.isPending ? 'Saving...' : 'Save Changes')
                                            : (createPO.isPending ? 'Creating...' : 'Create Order')}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        )}

        {addSupplierOpen && (
            <SupplierFormDialog
                editing={null}
                isPending={createSupplier.isPending}
                onClose={() => setAddSupplierOpen(false)}
                onSubmit={(data) => createSupplier.mutate(data, {
                    onSuccess: (s) => { toast.success('Supplier created'); setSupplierId(s.id); setAddSupplierOpen(false); },
                    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create supplier')),
                })}
            />
        )}

        {addWarehouseOpen && (
            <WarehouseQuickCreateDialog
                orgSlug={orgSlug}
                onClose={() => setAddWarehouseOpen(false)}
                onCreated={(wh) => { activeWarehouse.setWarehouseId(wh.id); setAddWarehouseOpen(false); }}
            />
        )}

        <DetailDrawer
            open={!!selectedPO}
            onClose={() => setSelectedPO(null)}
            loading={!!selectedPO && !poDetail}
            title={poDetail?.po_number ?? 'Purchase Order'}
            subtitle={poDetail?.supplier_name}
            badges={poDetail && (
                <>
                    <Badge variant={STATUS_VARIANT[poDetail.status] ?? 'default'}>
                        {STATUS_LABEL[poDetail.status] ?? poDetail.status}
                    </Badge>
                    {approvalStatus && (
                        <Badge variant={approvalStatus === 'approved' ? 'success' : approvalStatus === 'rejected' ? 'error' : 'warning'}>
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            {approvalStatus === 'pending'
                                ? `Awaiting approval${poApproval?.current_step ? ` · ${poApproval.current_step.name}` : ''}`
                                : `Approval ${approvalStatus}`}
                        </Badge>
                    )}
                </>
            )}
            fields={poDetail ? [
                { label: 'Supplier', value: poDetail.supplier_name },
                { label: 'Warehouse', value: poDetail.warehouse_name ?? '—' },
                { label: 'Date', value: new Date(poDetail.created_at).toLocaleDateString() },
                { label: 'Total', value: poDetail.total_amount.toLocaleString() },
                { label: 'Notes', value: poDetail.notes, full: true, hideIfEmpty: true },
            ] : []}
            actions={poDetail && (
                <>
                    <Button size="sm" variant="outline" onClick={() => previewPO(poDetail)}>
                        <Printer className="h-4 w-4 mr-2" /> Print / Export
                    </Button>
                    {showSubmit && (
                        <Button size="sm" variant="outline" disabled={submitForApproval.isPending}
                            onClick={() => submitForApproval.mutate(poDetail.id, {
                                onSuccess: (res) => toast.success(res.approval_required ? 'Submitted for approval' : 'No approval rule matches — you can send this order directly'),
                                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to submit for approval')),
                            })}>
                            <ShieldCheck className="h-4 w-4 mr-2" /> Submit for Approval
                        </Button>
                    )}
                    {canAmend && (
                        <Button size="sm" variant="outline" disabled={isPOBusy} onClick={() => startAmend(poDetail)}>Amend</Button>
                    )}
                    {canSend && (
                        <Button size="sm" disabled={isPOBusy}
                            onClick={() => sendPO.mutate(poDetail.id, {
                                onSuccess: () => toast.success('PO sent to supplier'),
                                onError: (e: unknown) => {
                                    const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
                                    toast.error(msg || 'Failed to send PO');
                                },
                            })}>
                            Send to Supplier
                        </Button>
                    )}
                    {canReceive && (
                        <Button size="sm" variant="outline" disabled={isPOBusy}
                            onClick={() => receivePO.mutate({ id: poDetail.id }, {
                                onSuccess: () => toast.success('PO received — stock updated'),
                                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to receive PO')),
                            })}>
                            Mark Received
                        </Button>
                    )}
                    {canCancel && (
                        <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" disabled={isPOBusy}
                            onClick={() => {
                                if (!confirm('Cancel this purchase order?')) return;
                                cancelPO.mutate(poDetail.id, {
                                    onSuccess: () => { toast.success('PO cancelled'); setSelectedPO(null); },
                                    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to cancel PO')),
                                });
                            }}>
                            Cancel Order
                        </Button>
                    )}
                </>
            )}
        >
            {poDetail && (
                <>
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold">Line Items</h3>
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Qty</th>
                                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Unit</th>
                                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Recv</th>
                                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Unit Cost</th>
                                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {(poDetail.line_items?.length ?? 0) === 0 ? (
                                        <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No line items</td></tr>
                                    ) : (
                                        poDetail.line_items?.map((line) => (
                                            <tr key={line.id}>
                                                <td className="px-3 py-2">
                                                    <div className="font-medium">{line.item_name ?? '—'}</div>
                                                    {line.item_sku && <div className="font-mono text-xs text-muted-foreground">{line.item_sku}</div>}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">{line.quantity}</td>
                                                <td className="px-3 py-2 text-muted-foreground">{line.unit || '—'}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{line.received_qty ?? 0}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{line.unit_cost.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-right font-semibold tabular-nums">{line.total_cost.toLocaleString()}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                                {(poDetail.line_items?.length ?? 0) > 0 && (
                                    <tfoot>
                                        <tr className="border-t-2 border-border bg-muted/30">
                                            <td colSpan={5} className="px-3 py-2 text-right font-semibold">Grand Total</td>
                                            <td className="px-3 py-2 text-right font-bold tabular-nums">{poDetail.total_amount.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                )}
                            </table>
                        </div>
                    </div>
                    <ThreeWayMatchPanel org={orgSlug} poId={poDetail.id} />
                </>
            )}
        </DetailDrawer>

        <PdfPreview {...previewProps} />
        </>
    );
}
