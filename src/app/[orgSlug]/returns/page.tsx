'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { DetailDrawer } from '@/components/inventory/DetailDrawer';
import { RowActions } from '@/components/inventory/RowActions';
import { usePurchaseReturns, useCreatePurchaseReturn, useApprovePurchaseReturn } from '@/hooks/usePurchaseReturns';
import { useSuppliers } from '@/hooks/useSuppliers';
import { type PurchaseReturn, type ReturnPaymentStatus } from '@/lib/api/purchase-returns';
import { AlertTriangle, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiErrorMessage } from '@/lib/api/error-message';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';

const ITEMS_PER_PAGE = 20;
const selectClass = 'w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';

const STATUS_VARIANT: Record<ReturnPaymentStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    pending: 'warning', due: 'warning', partial: 'default', paid: 'success',
};

interface Line { itemId: string; itemName: string; quantity: string; unitCost: string; subTotal: string }
const emptyLine = (): Line => ({ itemId: '', itemName: '', quantity: '1', unitCost: '', subTotal: '' });

export default function PurchaseReturnsPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const [status, setStatus] = useState<ReturnPaymentStatus | ''>('');
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState(false);
    const [viewing, setViewing] = useState<PurchaseReturn | null>(null);

    const [supplierId, setSupplierId] = useState('');
    const [reason, setReason] = useState('');
    const [lines, setLines] = useState<Line[]>([emptyLine()]);

    const { data, isLoading, isError, refetch } = usePurchaseReturns(org, { payment_status: status || undefined, page, limit: ITEMS_PER_PAGE });
    const create = useCreatePurchaseReturn(org);
    const approve = useApprovePurchaseReturn(org);
    const { data: suppliersPage } = useSuppliers(org);
    const suppliers = suppliersPage?.data ?? [];

    const { canAny } = usePermissions();
    const canAdd = canAny([P.PURCHASES_ADD, P.PURCHASES_MANAGE]);
    const canChange = canAny([P.PURCHASES_CHANGE, P.PURCHASES_MANAGE]);

    const rows = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE));
    useMemo(() => { setPage(1); }, [status]);

    const nameOf = (id?: string | null) => suppliers.find((s) => s.id === id)?.name ?? '—';
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

    function submit(e: React.FormEvent) {
        e.preventDefault();
        const payloadLines = lines.filter((l) => l.itemId).map((l) => ({ item_id: l.itemId, quantity: parseDecimal(l.quantity, 1), sub_total: parseDecimal(l.subTotal) }));
        if (payloadLines.length === 0) { toast.error('Add at least one item'); return; }
        create.mutate({ supplier_id: supplierId || undefined, reason: reason.trim() || undefined, lines: payloadLines }, {
            onSuccess: () => { toast.success('Return created'); setOpen(false); setSupplierId(''); setReason(''); setLines([emptyLine()]); },
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create return')),
        });
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><RotateCcw className="h-6 w-6" /> Purchase Returns</h1>
                    <p className="text-muted-foreground mt-1">Supplier RMAs &amp; credit notes</p>
                </div>
                {canAdd && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Return</Button>}
            </div>

            <Card>
                <CardHeader>
                    <select className="border border-border rounded-md px-3 py-2 text-sm bg-background w-fit" value={status} onChange={(e) => setStatus(e.target.value as ReturnPaymentStatus | '')}>
                        <option value="">All statuses</option>
                        {(['pending', 'due', 'partial', 'paid'] as ReturnPaymentStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Return #</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Supplier</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Amount</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Date</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading…</td></tr>}
                                {!isLoading && isError && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                                            <p className="text-muted-foreground">Couldn&apos;t load returns</p>
                                            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                        </td>
                                    </tr>
                                )}
                                {!isLoading && !isError && rows.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <RotateCcw className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No returns yet</p>
                                        </td>
                                    </tr>
                                )}
                                {!isError && rows.map((r) => (
                                    <tr key={r.id} className="border-b border-border hover:bg-muted/20 cursor-pointer" onClick={() => setViewing(r)}>
                                        <td className="px-6 py-3 font-medium font-mono text-xs">{r.return_number}</td>
                                        <td className="px-6 py-3 hidden md:table-cell">{nameOf(r.supplier_id)}</td>
                                        <td className="px-6 py-3 text-right tabular-nums">{r.return_amount.toLocaleString()}</td>
                                        <td className="px-6 py-3"><Badge variant={STATUS_VARIANT[r.payment_status]}>{r.payment_status}</Badge></td>
                                        <td className="px-6 py-3 hidden lg:table-cell text-muted-foreground">{new Date(r.date_returned).toLocaleDateString()}</td>
                                        <td className="px-6 py-3">
                                            <RowActions
                                                onView={() => setViewing(r)}
                                                extra={canChange && r.payment_status !== 'paid' && (
                                                    <Button variant="outline" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); approve.mutate(r.id, { onSuccess: () => toast.success('Return approved — stock adjusted'), onError: async (err) => toast.error(await apiErrorMessage(err, 'Failed to approve')) }); }}>Approve</Button>
                                                )}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>}
                </CardContent>
            </Card>

            {open && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
                    <div className="relative z-50 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">New Purchase Return</h2>
                                    <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-accent transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={submit} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Supplier</label>
                                        <select className={selectClass} value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                                            <option value="">— Select supplier —</option>
                                            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Reason</label>
                                        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Damaged on arrival" />
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium">Returned Items *</label>
                                            <Button type="button" variant="ghost" size="sm" onClick={() => setLines((ls) => [...ls, emptyLine()])}><Plus className="h-3 w-3 mr-1" /> Add</Button>
                                        </div>
                                        {lines.map((l, i) => (
                                            <div key={i} className="space-y-2 p-3 rounded-lg border border-border">
                                                {/* Selecting an item prefills its unit cost (cost_price → purchase_price) and
                                                    the sub-total — previously both were discarded and left blank. */}
                                                <ItemSearchInput
                                                    orgSlug={org}
                                                    value={l.itemName}
                                                    onSelect={(item) => setLineRecalc(i, {
                                                        itemId: item.id,
                                                        itemName: item.name,
                                                        unitCost: String(item.cost_price ?? item.purchase_price ?? ''),
                                                    })}
                                                    placeholder="Search item…"
                                                />
                                                <div className="grid grid-cols-12 gap-2 items-center">
                                                    <Input className="col-span-3" type="number" min="1" step={DECIMAL_STEP} placeholder="Qty" value={l.quantity} onChange={(e) => setLineRecalc(i, { quantity: e.target.value })} />
                                                    <Input className="col-span-4" type="number" min="0" step={DECIMAL_STEP} placeholder="Unit cost" value={l.unitCost} onChange={(e) => setLineRecalc(i, { unitCost: e.target.value })} />
                                                    <Input className="col-span-4" type="number" min="0" step={DECIMAL_STEP} placeholder="Sub-total" value={l.subTotal} onChange={(e) => setLine(i, { subTotal: e.target.value })} />
                                                    {lines.length > 1 && <button type="button" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))} className="col-span-1 text-muted-foreground hover:text-red-500"><Minus className="h-4 w-4" /></button>}
                                                </div>
                                            </div>
                                        ))}
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
                subtitle={viewing ? nameOf(viewing.supplier_id) : undefined}
                badges={viewing && <Badge variant={STATUS_VARIANT[viewing.payment_status]}>{viewing.payment_status}</Badge>}
                fields={viewing ? [
                    { label: 'Supplier', value: nameOf(viewing.supplier_id) },
                    { label: 'Amount', value: viewing.return_amount.toLocaleString() },
                    { label: 'Date returned', value: new Date(viewing.date_returned).toLocaleDateString() },
                    { label: 'Reason', value: viewing.reason, full: true, hideIfEmpty: true },
                ] : []}
                actions={viewing && canChange && viewing.payment_status !== 'paid' && (
                    <Button size="sm" onClick={() => approve.mutate(viewing.id, { onSuccess: () => { toast.success('Return approved — stock adjusted'); setViewing(null); }, onError: async (err) => toast.error(await apiErrorMessage(err, 'Failed to approve')) })}>Approve</Button>
                )}
            />
        </div>
    );
}
