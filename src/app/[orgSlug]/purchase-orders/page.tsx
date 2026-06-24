'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { SupplierFormDialog } from '@/components/inventory/SupplierFormDialog';
import { WarehouseQuickCreateDialog } from '@/components/inventory/WarehouseQuickCreateDialog';
import { ThreeWayMatchPanel } from '@/components/inventory/ThreeWayMatchPanel';
import {
    usePurchaseOrders,
    usePurchaseOrder,
    useCreatePurchaseOrder,
    useAmendPurchaseOrder,
    useSendPurchaseOrder,
    useReceivePurchaseOrder,
    useCancelPurchaseOrder,
} from '@/hooks/usePurchaseOrders';
import type { PurchaseOrder } from '@/lib/api/purchase-orders';
import { useSuppliers, useCreateSupplier } from '@/hooks/useSuppliers';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useApprovalForObject, useSubmitPurchaseOrderForApproval } from '@/hooks/useApprovals';
import { AlertTriangle, ArrowLeft, BarChart3, Eye, FileText, Minus, Plus, Printer, Search, ShieldCheck, X } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiClient } from '@/lib/api/client';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';

const ITEMS_PER_PAGE = 20;

interface POLine {
    itemId: string;
    itemName: string;
    quantity: string;
    unitPrice: string;
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
    const [warehouseId, setWarehouseId] = useState('');
    const [expectedDate, setExpectedDate] = useState('');
    const [poNotes, setPoNotes] = useState('');
    const [payTermDays, setPayTermDays] = useState('');
    const [additionalShipping, setAdditionalShipping] = useState('');
    const [poLines, setPoLines] = useState<POLine[]>([{ itemId: '', itemName: '', quantity: '', unitPrice: '' }]);

    const { data: suppliersPage } = useSuppliers(orgSlug);
    const suppliers = suppliersPage?.data;
    const { data: warehouses } = useWarehouses(orgSlug);
    const createSupplier = useCreateSupplier(orgSlug);
    const [addSupplierOpen, setAddSupplierOpen] = useState(false);
    const [addWarehouseOpen, setAddWarehouseOpen] = useState(false);
    const { data: orders, isLoading, isError, refetch } = usePurchaseOrders(orgSlug);
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

    const filtered = (orders ?? []).filter((o) => {
        const matchesSearch = !search ||
            o.po_number.toLowerCase().includes(search.toLowerCase()) ||
            (o.supplier_name ?? '').toLowerCase().includes(search.toLowerCase());
        const matchesStatus = !statusFilter || o.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.max(1, Math.ceil((filtered?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = filtered?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    useMemo(() => { setPage(1); }, [search, statusFilter]);

    function addPOLine() {
        setPoLines([...poLines, { itemId: '', itemName: '', quantity: '', unitPrice: '' }]);
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
        setWarehouseId('');
        setExpectedDate('');
        setPoNotes('');
        setPayTermDays('');
        setAdditionalShipping('');
        setPoLines([{ itemId: '', itemName: '', quantity: '', unitPrice: '' }]);
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
        setWarehouseId(po.warehouse_id);
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
            }))
        );
        if ((po.line_items?.length ?? 0) === 0) {
            setPoLines([{ itemId: '', itemName: '', quantity: '', unitPrice: '' }]);
        }
        setCreateOpen(true);
    }

    function handlePOSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!supplierId) { toast.error('Select a supplier'); return; }
        if (!warehouseId) { toast.error('Select a warehouse'); return; }
        const lines = poLines
            .filter((l) => l.itemId && parseFloat(l.quantity) > 0)
            .map((l) => ({
                item_id: l.itemId,
                quantity: parseFloat(l.quantity),
                unit_cost: parseFloat(l.unitPrice) || 0,
            }));
        if (lines.length === 0) { toast.error('Add at least one item'); return; }

        const payload = {
            supplier_id: supplierId,
            warehouse_id: warehouseId,
            expected_date: expectedDate || undefined,
            notes: poNotes.trim() || undefined,
            pay_term_days: parseInt(payTermDays) > 0 ? parseInt(payTermDays) : undefined,
            additional_shipping_charges: parseFloat(additionalShipping) > 0 ? parseFloat(additionalShipping) : undefined,
            line_items: lines,
        };

        if (amendingId) {
            amendPO.mutate({ id: amendingId, data: payload }, {
                onSuccess: () => { toast.success('Purchase order amended'); closePODialog(); },
                onError: () => toast.error('Failed to amend purchase order'),
            });
            return;
        }

        createPO.mutate(payload, {
            onSuccess: () => { toast.success('Purchase order created'); closePODialog(); },
            onError: () => toast.error('Failed to create purchase order'),
        });
    }

    if (selectedPO && poDetail) {
        const isPOBusy = sendPO.isPending || receivePO.isPending || cancelPO.isPending;
        const canSend = canChangePO && poDetail.status === 'draft';
        const canReceive = canChangePO && (poDetail.status === 'sent' || poDetail.status === 'partially_received' || poDetail.status === 'draft');
        const canCancel = canCancelPO && (poDetail.status === 'draft' || poDetail.status === 'sent');
        // Amend is allowed only before goods start arriving (draft or sent) — it replaces all lines.
        const canAmend = canChangePO && (poDetail.status === 'draft' || poDetail.status === 'sent');
        // Approval-matrix awareness: offer "Submit for Approval" on drafts that have not
        // already entered (or cleared) an approval workflow.
        const approvalStatus = poApproval?.status;
        const showSubmit = canChangePO && poDetail.status === 'draft' && approvalStatus !== 'pending' && approvalStatus !== 'approved';

        return (
            <div className="p-6 space-y-6">
                <div className="flex flex-wrap items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPO(null)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{poDetail.po_number}</h1>
                        <p className="text-muted-foreground text-sm">{poDetail.supplier_name}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[poDetail.status] ?? 'default'} className="ml-2">
                        {STATUS_LABEL[poDetail.status] ?? poDetail.status}
                    </Badge>
                    {approvalStatus && (
                        <Badge
                            variant={approvalStatus === 'approved' ? 'success' : approvalStatus === 'rejected' ? 'error' : 'warning'}
                            className="ml-1"
                        >
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            {approvalStatus === 'pending'
                                ? `Awaiting approval${poApproval?.current_step ? ` · ${poApproval.current_step.name}` : ''}`
                                : `Approval ${approvalStatus}`}
                        </Badge>
                    )}
                    <div className="ml-auto flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => previewPO(poDetail)}>
                            <Printer className="h-4 w-4 mr-2" />
                            Print / Export
                        </Button>
                        {showSubmit && (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={submitForApproval.isPending}
                                onClick={() => submitForApproval.mutate(poDetail.id, {
                                    onSuccess: (res) => toast.success(
                                        res.approval_required
                                            ? 'Submitted for approval'
                                            : 'No approval rule matches — you can send this order directly',
                                    ),
                                    onError: () => toast.error('Failed to submit for approval'),
                                })}
                            >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Submit for Approval
                            </Button>
                        )}
                        {canAmend && (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={isPOBusy}
                                onClick={() => startAmend(poDetail)}
                            >
                                Amend
                            </Button>
                        )}
                        {canSend && (
                            <Button
                                size="sm"
                                disabled={isPOBusy}
                                onClick={() => sendPO.mutate(poDetail.id, {
                                    onSuccess: () => toast.success('PO sent to supplier'),
                                    onError: (e: unknown) => {
                                        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
                                        toast.error(msg || 'Failed to send PO');
                                    },
                                })}
                            >
                                Send to Supplier
                            </Button>
                        )}
                        {canReceive && (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={isPOBusy}
                                onClick={() => receivePO.mutate({ id: poDetail.id }, {
                                    onSuccess: () => toast.success('PO received — stock updated'),
                                    onError: () => toast.error('Failed to receive PO'),
                                })}
                            >
                                Mark Received
                            </Button>
                        )}
                        {canCancel && (
                            <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                disabled={isPOBusy}
                                onClick={() => {
                                    if (!confirm('Cancel this purchase order?')) return;
                                    cancelPO.mutate(poDetail.id, {
                                        onSuccess: () => { toast.success('PO cancelled'); setSelectedPO(null); },
                                        onError: () => toast.error('Failed to cancel PO'),
                                    });
                                }}
                            >
                                Cancel Order
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <h2 className="text-lg font-semibold">Line Items</h2>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/30">
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Item</th>
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">SKU</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Qty</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Received</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Outstanding</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Unit Cost</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(poDetail.line_items?.length ?? 0) === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="px-6 py-8 text-center text-muted-foreground">
                                                    No line items
                                                </td>
                                            </tr>
                                        ) : (
                                            poDetail.line_items?.map((line) => {
                                                const recv = line.received_qty ?? 0;
                                                const outstanding = Math.max(0, line.quantity - recv);
                                                return (
                                                <tr key={line.id} className="hover:bg-accent/30 transition-colors">
                                                    <td className="px-6 py-3 font-medium">{line.item_name ?? '—'}</td>
                                                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{line.item_sku ?? '—'}</td>
                                                    <td className="px-6 py-3 text-right tabular-nums">{line.quantity}</td>
                                                    <td className="px-6 py-3 text-right tabular-nums">{recv}</td>
                                                    <td className={`px-6 py-3 text-right tabular-nums ${outstanding > 0 ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>{outstanding}</td>
                                                    <td className="px-6 py-3 text-right tabular-nums">{line.unit_cost.toLocaleString()}</td>
                                                    <td className="px-6 py-3 text-right font-semibold tabular-nums">{line.total_cost.toLocaleString()}</td>
                                                </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                    {(poDetail.line_items?.length ?? 0) > 0 && (
                                        <tfoot>
                                            <tr className="border-t-2 border-border bg-muted/30">
                                                <td colSpan={6} className="px-6 py-3 text-right font-semibold">Grand Total</td>
                                                <td className="px-6 py-3 text-right font-bold tabular-nums">{poDetail.total_amount.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <h2 className="text-lg font-semibold">Order Info</h2>
                        </CardHeader>
                        <CardContent>
                            <dl className="space-y-4 text-sm">
                                <div>
                                    <dt className="text-muted-foreground">PO Number</dt>
                                    <dd className="font-medium mt-1 font-mono">{poDetail.po_number}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Supplier</dt>
                                    <dd className="font-medium mt-1">{poDetail.supplier_name}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Warehouse</dt>
                                    <dd className="font-medium mt-1">{poDetail.warehouse_name ?? '—'}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Date</dt>
                                    <dd className="font-medium mt-1">{new Date(poDetail.created_at).toLocaleDateString()}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Total</dt>
                                    <dd className="font-bold text-lg mt-1">{poDetail.total_amount.toLocaleString()}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>
                </div>

                <ThreeWayMatchPanel org={orgSlug} poId={poDetail.id} />
            </div>
        );
    }

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
                                ) : (filtered?.length ?? 0) === 0 ? (
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
                                                <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="sm" aria-label="View" title="View details" onClick={() => setSelectedPO(po.id)}>
                                                        <Eye className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" aria-label="Print / Export" title="Print / Export PDF" onClick={() => previewPO(po)}>
                                                        <Printer className="h-4 w-4" />
                                                    </Button>
                                                </div>
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
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Warehouse *</label>
                                        <CreatableSelect
                                            value={warehouseId}
                                            onChange={setWarehouseId}
                                            options={(warehouses ?? []).map((wh) => ({ id: wh.id, name: wh.name }))}
                                            placeholder="Select warehouse..."
                                            required
                                            onAddClick={() => setAddWarehouseOpen(true)}
                                            addLabel="Add warehouse"
                                        />
                                    </div>
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
                                            step="0.01"
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
                                                onSelect={(item) => {
                                                    const updated = [...poLines];
                                                    updated[idx] = { ...updated[idx], itemId: item.id, itemName: item.name };
                                                    setPoLines(updated);
                                                }}
                                                placeholder="Search item..."
                                            />
                                            <div className="grid grid-cols-3 gap-2 items-center">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Qty</label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="any"
                                                        placeholder="1"
                                                        value={line.quantity}
                                                        onChange={(e) => updatePOLine(idx, 'quantity', e.target.value)}
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Unit Cost</label>
                                                    <Input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
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
                    onError: () => toast.error('Failed to create supplier'),
                })}
            />
        )}

        {addWarehouseOpen && (
            <WarehouseQuickCreateDialog
                orgSlug={orgSlug}
                onClose={() => setAddWarehouseOpen(false)}
                onCreated={(wh) => { setWarehouseId(wh.id); setAddWarehouseOpen(false); }}
            />
        )}

        <PdfPreview {...previewProps} />
        </>
    );
}
