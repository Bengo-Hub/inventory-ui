'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { DetailDrawer } from '@/components/inventory/DetailDrawer';
import { DocFormatMenu, type DocFormat } from '@/components/inventory/DocFormatMenu';
import { downloadBlob } from '@/components/inventory/ExportDialogs';
import { ActiveWarehousePicker } from '@/components/inventory/ActiveWarehousePicker';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { usePurchaseReturns, useCreatePurchaseReturn, useApprovePurchaseReturn } from '@/hooks/usePurchaseReturns';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useActiveWarehouse } from '@/hooks/useActiveWarehouse';
import { type PurchaseReturn, type ReturnPaymentStatus } from '@/lib/api/purchase-returns';
import { approvalGateFromError } from '@/lib/api/approvals';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildReturnsColumns, returnDay, STATUS_LABEL, STATUS_VARIANT } from './returns-columns';
import { Minus, Plus, RotateCcw, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiErrorMessage } from '@/lib/api/error-message';
import { DECIMAL_STEP, localDateInput, parseDecimal } from '@/lib/utils';
import { apiClient } from '@/lib/api/client';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';
import { supplierBalanceLabel } from '@/lib/supplier-balance';
import { SupplierBalanceNote } from '@/components/inventory/SupplierBalanceNote';
import { useOutletFilterStore } from '@/store/outlet-filter';

const selectClass = 'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';

interface Line { itemId: string; itemName: string; sku: string; quantity: string; unitCost: string; subTotal: string }
const emptyLine = (): Line => ({ itemId: '', itemName: '', sku: '', quantity: '1', unitCost: '', subTotal: '' });

export default function PurchaseReturnsPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const [status, setStatus] = useState<ReturnPaymentStatus | ''>('');
    const [range, setRange] = useState<DateRange>({ from: '', to: '' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [open, setOpen] = useState(false);
    const [viewing, setViewing] = useState<PurchaseReturn | null>(null);

    const [supplierId, setSupplierId] = useState('');
    const [reason, setReason] = useState('');
    // Local calendar day (the UTC day lags a day until 03:00 in Kenya), and re-seeded every time
    // the form opens so a tab left open overnight never defaults to yesterday.
    const [dateReturned, setDateReturned] = useState(() => localDateInput());
    const [lines, setLines] = useState<Line[]>([emptyLine()]);

    // Where the goods leave from: defaults to the active outlet's warehouse (same shared resolver
    // as Adjustments, Purchase Orders and Transfers), required when "All Outlets" is selected.
    const activeWarehouse = useActiveWarehouse(org);
    // Reads follow the top-nav outlet drill-down, like every other list.
    const filterOutlet = useOutletFilterStore((s) => s.selectedOutlet);

    const { data, isLoading, isError, refetch } = usePurchaseReturns(org, {
        payment_status: status || undefined, from: range.from || undefined, to: range.to || undefined,
        outlet_id: filterOutlet?.id, page, limit: pageSize,
    });
    const create = useCreatePurchaseReturn(org);
    const approve = useApprovePurchaseReturn(org);
    const { data: suppliersPage } = useSuppliers(org);
    const suppliers = suppliersPage?.data ?? [];

    const { canAny } = usePermissions();
    const canAdd = canAny([P.PURCHASES_ADD, P.PURCHASES_MANAGE]);
    const canChange = canAny([P.PURCHASES_CHANGE, P.PURCHASES_MANAGE]);

    const rows = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
    useMemo(() => { setPage(1); }, [status, range, pageSize, filterOutlet?.id]);

    const nameOf = (r: PurchaseReturn) => r.supplier_name || suppliers.find((s) => s.id === r.supplier_id)?.name || '—';
    const setLine = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
    // Sub-total follows qty × unit cost while the user hasn't overridden it directly.
    const setLineRecalc = (i: number, patch: Partial<Line>) => setLines((ls) => ls.map((l, idx) => {
        if (idx !== i) return l;
        const next = { ...l, ...patch };
        const qty = parseDecimal(next.quantity, 1);
        const cost = parseDecimal(next.unitCost);
        if (cost > 0) next.subTotal = String(Math.round(qty * cost * 100) / 100);
        return next;
    }));
    const formTotal = lines.reduce((sum, l) => sum + (l.itemId ? parseDecimal(l.subTotal) : 0), 0);

    function resetForm() {
        setSupplierId('');
        setReason('');
        setDateReturned(localDateInput());
        setLines([emptyLine()]);
        activeWarehouse.reset();
    }
    function openForm() {
        resetForm();
        setOpen(true);
    }

    function handleApprove(r: PurchaseReturn, after?: () => void) {
        approve.mutate(r.id, {
            onSuccess: (res) => {
                if (res.stock_warnings?.length) {
                    toast.warning(`Return approved, but some items could not be taken out of stock: ${res.stock_warnings.join('; ')}`, { duration: 10000 });
                } else {
                    toast.success(`${r.return_number} approved: ${r.item_count} item${r.item_count === 1 ? '' : 's'} taken out of stock and the supplier credited`);
                }
                after?.();
            },
            onError: async (err) => {
                const gate = approvalGateFromError(err);
                if (gate) {
                    toast.info(gate.state === 'rejected'
                        ? 'This return was rejected by an approver.'
                        : 'This return needs manager approval first; a request has been sent. Approve it again once it is signed off.', { duration: 6000 });
                    return;
                }
                toast.error(await apiErrorMessage(err, 'Failed to approve'));
            },
        });
    }

    // Document preview (Print/Export) — same shared-ui-lib PDF previewer as Purchase Orders,
    // streaming inventory-api's GET /purchase-returns/{id}/pdf (debit-note style RTV document).
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function previewReturn(r: PurchaseReturn, format: DocFormat = 'pdf') {
        const url = `/api/v1/${org}/inventory/purchase-returns/${r.id}/pdf`;
        if (format === 'pdf') {
            openPreview(() => apiClient.getBlob(url, { format }), { fileName: `${r.return_number}.pdf`, title: r.return_number });
            return;
        }
        apiClient.getBlob(url, { format })
            .then((blob) => downloadBlob(blob, `${r.return_number}.${format}`))
            .catch(() => toast.error('Could not export purchase return. Please try again.'));
    }

    const columns = useMemo(
        () => buildReturnsColumns({
            canChange,
            nameOf,
            onView: (r) => setViewing(r),
            onApprove: (r) => handleApprove(r),
            onPrint: (r) => previewReturn(r),
        }),
        [canChange, suppliers],
    );

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const picked = lines.filter((l) => l.itemId);
        if (picked.length === 0) { toast.error('Add at least one item'); return; }
        if (picked.some((l) => parseDecimal(l.quantity) <= 0)) { toast.error('Every returned item needs a quantity above zero'); return; }
        if (activeWarehouse.unresolved) { toast.error('Select the location the goods are leaving from'); return; }
        const payloadLines = picked.map((l) => ({ item_id: l.itemId, quantity: parseDecimal(l.quantity, 1), sub_total: parseDecimal(l.subTotal) }));
        create.mutate({
            supplier_id: supplierId || undefined,
            warehouse_id: activeWarehouse.warehouseId || undefined,
            reason: reason.trim() || undefined,
            date_returned: dateReturned || undefined,
            lines: payloadLines,
        }, {
            onSuccess: (created) => { toast.success(`Return ${created.return_number} created`); setOpen(false); resetForm(); },
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create return')),
        });
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><RotateCcw className="h-6 w-6" /> Purchase Returns</h1>
                    <p className="text-muted-foreground mt-1">Goods sent back to suppliers. Approving a return takes the items out of stock and credits the supplier.</p>
                </div>
                {canAdd && <Button onClick={openForm}><Plus className="h-4 w-4 mr-2" /> New Return</Button>}
            </div>

            <Card>
                <CardHeader className="flex flex-row flex-wrap items-center gap-2">
                    <select className="border border-border rounded-md px-3 py-2 text-sm bg-background w-fit" value={status} onChange={(e) => setStatus(e.target.value as ReturnPaymentStatus | '')}>
                        <option value="">All statuses</option>
                        {(['pending', 'paid'] as ReturnPaymentStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                    <DateRangePicker value={range} onChange={setRange} className="w-56" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<PurchaseReturn>
                            columns={columns}
                            rows={rows}
                            rowKey={(r) => r.id}
                            loading={isLoading}
                            loadingRows={8}
                            error={isError}
                            onRetry={() => refetch()}
                            onRowClick={(r) => setViewing(r)}
                            emptyText="No returns yet"
                            storageKey="purchase-returns-col-prefs"
                            page={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            total={data?.total}
                            pageSize={pageSize}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
                </CardContent>
            </Card>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
                    <div className="relative z-50 w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">New Purchase Return</h2>
                                    <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-accent transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={submit} className="space-y-4">
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Supplier</label>
                                            <select className={selectClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                                                <option value="">— Select supplier —</option>
                                                {suppliers.map((s) => {
                                                    const bal = supplierBalanceLabel(s);
                                                    return <option key={s.id} value={s.id}>{bal ? `${s.name} — ${bal}` : s.name}</option>;
                                                })}
                                            </select>
                                            <SupplierBalanceNote orgSlug={org} supplierId={supplierId} />
                                        </div>
                                        <ActiveWarehousePicker active={activeWarehouse} label="Returning from (location)" required />
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Reason</label>
                                            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged on arrival" />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Date Returned</label>
                                            <Input type="date" value={dateReturned} max={localDateInput()} onChange={(e) => setDateReturned(e.target.value)} />
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium">Returned Items *</label>
                                            <Button type="button" variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, emptyLine()])}><Plus className="h-3 w-3 mr-1" /> Add item</Button>
                                        </div>
                                        <div className="hidden sm:grid grid-cols-12 gap-2 px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            <span className="col-span-3">Quantity</span>
                                            <span className="col-span-4">Unit cost</span>
                                            <span className="col-span-4">Sub-total</span>
                                        </div>
                                        {lines.map((l, i) => (
                                            <div key={i} className="space-y-2 p-3 rounded-lg border border-border">
                                                {/* Selecting an item prefills its unit cost (cost_price → purchase_price) and
                                                    the sub-total. */}
                                                <ItemSearchInput
                                                    orgSlug={org}
                                                    value={l.itemName}
                                                    onSelect={(item) => setLineRecalc(i, {
                                                        itemId: item.id,
                                                        itemName: item.name,
                                                        sku: item.sku ?? '',
                                                        unitCost: String(item.cost_price ?? item.purchase_price ?? ''),
                                                    })}
                                                    placeholder="Search item…"
                                                />
                                                {l.itemId && (
                                                    <p className="text-xs text-muted-foreground">
                                                        <span className="font-medium text-foreground">{l.itemName}</span>{l.sku ? ` · ${l.sku}` : ''}
                                                    </p>
                                                )}
                                                <div className="grid grid-cols-12 gap-2 items-center">
                                                    <Input className="col-span-3" type="number" min="0" step={DECIMAL_STEP} placeholder="Qty" aria-label="Quantity" value={l.quantity} onChange={(e) => setLineRecalc(i, { quantity: e.target.value })} />
                                                    <Input className="col-span-4" type="number" min="0" step={DECIMAL_STEP} placeholder="Unit cost" aria-label="Unit cost" value={l.unitCost} onChange={(e) => setLineRecalc(i, { unitCost: e.target.value })} />
                                                    <Input className="col-span-4" type="number" min="0" step={DECIMAL_STEP} placeholder="Sub-total" aria-label="Sub-total" value={l.subTotal} onChange={(e) => setLine(i, { subTotal: e.target.value })} />
                                                    {lines.length > 1 && <button type="button" aria-label="Remove item" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="col-span-1 text-muted-foreground hover:text-red-500"><Minus className="h-4 w-4" /></button>}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="flex justify-end text-sm">
                                            <span className="text-muted-foreground mr-2">Return total</span>
                                            <span className="font-semibold tabular-nums">{formTotal.toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <Button type="button" variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
                                        <Button type="submit" className="flex-1" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create Return'}</Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            <DetailDrawer
                open={!!viewing}
                onClose={() => setViewing(null)}
                title={viewing?.return_number ?? 'Purchase Return'}
                subtitle={viewing ? nameOf(viewing) : undefined}
                badges={viewing && <Badge variant={STATUS_VARIANT[viewing.payment_status]}>{STATUS_LABEL[viewing.payment_status] ?? viewing.payment_status}</Badge>}
                width="lg"
                fields={viewing ? [
                    { label: 'Supplier', value: nameOf(viewing) },
                    { label: 'Date returned', value: returnDay(viewing) },
                    { label: 'Location', value: viewing.warehouse_name || '—' },
                    { label: 'Amount', value: viewing.return_amount.toLocaleString() },
                    { label: 'Created by', value: viewing.added_by_name, hideIfEmpty: true },
                    { label: 'Reason', value: viewing.reason, full: true, hideIfEmpty: true },
                ] : []}
                actions={viewing && (
                    <>
                        <DocFormatMenu label="Print / Export" onSelect={(format) => previewReturn(viewing, format)} />
                        {canChange && viewing.payment_status !== 'paid' && (
                            <Button size="sm" disabled={approve.isPending} onClick={() => handleApprove(viewing, () => setViewing(null))}>Approve</Button>
                        )}
                    </>
                )}
            >
                {viewing && (
                    <div className="mt-4 space-y-2">
                        <h3 className="text-sm font-semibold">Returned items ({viewing.item_count})</h3>
                        {viewing.lines.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No items recorded on this return.</p>
                        ) : (
                            <div className="overflow-x-auto rounded-lg border border-border">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2 text-left">Item</th>
                                            <th className="px-3 py-2 text-right">Qty</th>
                                            <th className="px-3 py-2 text-right">Unit cost</th>
                                            <th className="px-3 py-2 text-right">Sub-total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {viewing.lines.map((l) => (
                                            <tr key={l.id}>
                                                <td className="px-3 py-2">
                                                    <p className="font-medium">{l.item_name}</p>
                                                    {l.sku && <p className="text-[11px] text-muted-foreground font-mono">{l.sku}</p>}
                                                </td>
                                                <td className="px-3 py-2 text-right tabular-nums">{l.quantity.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{l.unit_cost.toLocaleString()}</td>
                                                <td className="px-3 py-2 text-right tabular-nums">{l.sub_total.toLocaleString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="font-semibold">
                                            <td className="px-3 py-2" colSpan={3}>Total</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{viewing.return_amount.toLocaleString()}</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </DetailDrawer>

            <PdfPreview {...previewProps} />
        </div>
    );
}
