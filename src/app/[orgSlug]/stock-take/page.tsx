'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { InfoHint } from '@/components/ui/info-hint';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { SubscriptionGate } from '@/components/subscription/subscription-gate';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useCreateFromQuery } from '@/hooks/useCreateFromQuery';
import {
    useApproveStockCount,
    useCancelStockCount,
    useCreateStockCount,
    useStockCount,
    useStockCounts,
    useSubmitStockCount,
    useUpsertCountLine,
} from '@/hooks/useStockCounts';
import { usePermissions, P } from '@/hooks/usePermissions';
import type { StockCount, StockCountLine, StockCountStatus } from '@/lib/api/stock-counts';
import { apiErrorMessage } from '@/lib/api/error-message';
import { CheckCircle2, ClipboardCheck, ClipboardList, Plus, Send, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const STATUS_VARIANT: Record<StockCountStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    draft: 'outline',
    counting: 'warning',
    review: 'default',
    approved: 'success',
    cancelled: 'error',
};

const STATUS_LABEL: Record<StockCountStatus, string> = {
    draft: 'Draft',
    counting: 'Counting',
    review: 'In Review',
    approved: 'Approved',
    cancelled: 'Cancelled',
};

// ── Create dialog ───────────────────────────────────────────────────────────────

function CreateCountDialog({ orgSlug, onClose, onCreated }: {
    orgSlug: string;
    onClose: () => void;
    onCreated: (id: string) => void;
}) {
    const { data: warehouses } = useWarehouses(orgSlug);
    const create = useCreateStockCount(orgSlug);
    const [warehouseId, setWarehouseId] = useState('');
    const [reference, setReference] = useState('');
    const [snapshot, setSnapshot] = useState(true);

    function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!warehouseId) { toast.error('Pick a warehouse to count'); return; }
        create.mutate(
            { warehouse_id: warehouseId, reference: reference.trim() || undefined, snapshot },
            {
                onSuccess: (c) => { toast.success('Stock take started'); onCreated(c.id); },
                onError: async (err) => toast.error(await apiErrorMessage(err, 'Failed to start stock take')),
            },
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative z-50 w-full max-w-md mx-4">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">New Stock Take</h2>
                            <button onClick={onClose} className="p-1 rounded-lg hover:bg-accent"><X className="h-5 w-5 text-muted-foreground" /></button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Warehouse / Outlet *</label>
                                <select
                                    value={warehouseId}
                                    onChange={(e) => setWarehouseId(e.target.value)}
                                    className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                >
                                    <option value="">Select location…</option>
                                    {(warehouses ?? []).map((w) => (
                                        <option key={w.id} value={w.id}>{w.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Reference <span className="text-muted-foreground font-normal">(optional)</span></label>
                                <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. July month-end count" />
                            </div>
                            <label className="flex items-start gap-2 text-sm">
                                <input type="checkbox" checked={snapshot} onChange={(e) => setSnapshot(e.target.checked)} className="mt-0.5" />
                                <span>
                                    Pre-load every item at its current system quantity
                                    <InfoHint title="Snapshot">
                                        Fills the count sheet with each item and the quantity the system thinks you have right now.
                                        Your team then types what they physically counted; the difference becomes the variance. Turn
                                        off to start from a blank sheet and add items as you go.
                                    </InfoHint>
                                </span>
                            </label>
                            <div className="flex gap-3 pt-1">
                                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
                                <Button type="submit" className="flex-1" disabled={create.isPending}>
                                    {create.isPending ? 'Starting…' : 'Start Count'}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

// ── Line row (editable counted qty) ─────────────────────────────────────────────

function CountLineRow({ orgSlug, countId, line, editable }: {
    orgSlug: string;
    countId: string;
    line: StockCountLine;
    editable: boolean;
}) {
    const upsert = useUpsertCountLine(orgSlug, countId);
    const [value, setValue] = useState(line.counted_qty != null ? String(line.counted_qty) : '');

    const variance = value === '' ? null : parseFloat(value) - line.system_qty;

    function save() {
        if (value === '' || parseFloat(value) === line.counted_qty) return;
        upsert.mutate(
            { item_id: line.item_id, sku: line.sku, counted_qty: parseFloat(value) || 0 },
            { onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to save line')) },
        );
    }

    return (
        <tr className="border-b border-border last:border-0">
            <td className="px-3 py-2 font-mono text-xs">{line.sku}</td>
            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{line.system_qty}</td>
            <td className="px-3 py-2 text-right">
                {editable ? (
                    <Input
                        type="number"
                        step="any"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onBlur={save}
                        className="h-8 w-24 text-right text-sm ml-auto"
                        placeholder="—"
                    />
                ) : (
                    <span className="tabular-nums">{line.counted_qty ?? '—'}</span>
                )}
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
                {(variance ?? line.variance) == null ? (
                    <span className="text-muted-foreground">—</span>
                ) : (
                    <span className={(variance ?? line.variance)! === 0 ? 'text-muted-foreground' : (variance ?? line.variance)! > 0 ? 'text-emerald-600' : 'text-destructive'}>
                        {(variance ?? line.variance)! > 0 ? '+' : ''}{(variance ?? line.variance)}
                    </span>
                )}
            </td>
            <td className="px-3 py-2 text-right">
                {line.posted && <Badge variant="success">Posted</Badge>}
            </td>
        </tr>
    );
}

// ── Detail sheet ────────────────────────────────────────────────────────────────

function CountDetailSheet({ orgSlug, countId, onClose, canChange, canApprove }: {
    orgSlug: string;
    countId: string;
    onClose: () => void;
    canChange: boolean;
    canApprove: boolean;
}) {
    const { data: count, isLoading } = useStockCount(orgSlug, countId);
    const submit = useSubmitStockCount(orgSlug);
    const approve = useApproveStockCount(orgSlug);
    const cancel = useCancelStockCount(orgSlug);
    const addLine = useUpsertCountLine(orgSlug, countId);

    const status = count?.status;
    const editable = canChange && status === 'counting';

    function addItem(sku: string, itemId: string, systemQty: number) {
        addLine.mutate(
            { item_id: itemId, sku, system_qty: systemQty, counted_qty: 0 },
            { onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to add item')) },
        );
    }

    return (
        <Sheet open onClose={onClose} width="lg">
            <SheetHeader>
                <SheetTitle>Stock Take {count?.reference ? `· ${count.reference}` : ''}</SheetTitle>
            </SheetHeader>
            <SheetContent>
                {isLoading || !count ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Loading count…</p>
                ) : (
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge variant={STATUS_VARIANT[count.status]}>{STATUS_LABEL[count.status]}</Badge>
                            <span className="text-xs text-muted-foreground">Started {new Date(count.created_at).toLocaleDateString()}</span>
                        </div>

                        <div className="rounded-lg border border-border bg-accent/20 p-3 text-xs text-muted-foreground">
                            <strong className="text-foreground">How a stock take works: </strong>
                            enter the physically counted quantity for each item while status is <em>Counting</em>, then
                            <em> Submit for review</em>. A supervisor <em>Approves</em>, which posts the variance for every
                            line as a stock adjustment (reason <em>count variance</em>) so your on-hand matches reality.
                        </div>

                        {editable && (
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Add an item to this count</label>
                                <ItemSearchInput
                                    orgSlug={orgSlug}
                                    value=""
                                    placeholder="Search item to add…"
                                    onSelect={(item) => addItem(item.sku, item.id, item.available ?? 0)}
                                />
                            </div>
                        )}

                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                                        <th className="px-3 py-2 text-left font-medium">SKU</th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            <span className="inline-flex items-center gap-1">System
                                                <InfoHint title="System quantity">What the system currently believes is on hand — the snapshot to count against.</InfoHint>
                                            </span>
                                        </th>
                                        <th className="px-3 py-2 text-right font-medium">Counted</th>
                                        <th className="px-3 py-2 text-right font-medium">
                                            <span className="inline-flex items-center gap-1">Variance
                                                <InfoHint title="Variance">Counted − System. Positive = surplus found, negative = shortage. Posted as an adjustment on approval.</InfoHint>
                                            </span>
                                        </th>
                                        <th className="px-3 py-2" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {count.lines.length === 0 ? (
                                        <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">No items yet. {editable ? 'Add items above.' : ''}</td></tr>
                                    ) : (
                                        count.lines.map((ln) => (
                                            <CountLineRow key={ln.id} orgSlug={orgSlug} countId={countId} line={ln} editable={editable} />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2">
                            {canChange && status === 'counting' && (
                                <Button
                                    onClick={() => submit.mutate(countId, {
                                        onSuccess: () => toast.success('Submitted for review'),
                                        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to submit')),
                                    })}
                                    disabled={submit.isPending}
                                >
                                    <Send className="h-4 w-4 mr-1.5" /> Submit for review
                                </Button>
                            )}
                            {canApprove && (status === 'review' || status === 'counting') && (
                                <Button
                                    onClick={() => approve.mutate(countId, {
                                        onSuccess: (res) => {
                                            if (res.status === 'partial') toast.warning(res.message ?? 'Some lines could not post');
                                            else toast.success(`Approved · ${res.posted_lines ?? 0} variance line(s) posted`);
                                        },
                                        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to approve')),
                                    })}
                                    disabled={approve.isPending}
                                >
                                    <CheckCircle2 className="h-4 w-4 mr-1.5" /> Approve &amp; post variances
                                </Button>
                            )}
                            {canChange && (status === 'counting' || status === 'review') && (
                                <Button
                                    variant="outline"
                                    className="text-destructive"
                                    onClick={() => cancel.mutate(countId, {
                                        onSuccess: () => { toast.success('Count cancelled'); onClose(); },
                                        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to cancel')),
                                    })}
                                    disabled={cancel.isPending}
                                >
                                    Cancel count
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

// ── Page ─────────────────────────────────────────────────────────────────────────

export default function StockTakePage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const { data: counts, isLoading } = useStockCounts(orgSlug);
    const { data: warehouses } = useWarehouses(orgSlug);
    const { canAny } = usePermissions();

    const canAdd = canAny([P.STOCK_COUNT_ADD, P.STOCK_MANAGE]);
    const canChange = canAny([P.STOCK_COUNT_CHANGE, P.STOCK_MANAGE]);
    const canApprove = canAny([P.STOCK_COUNT_APPROVE, P.STOCK_MANAGE]);

    const [createOpen, setCreateOpen] = useState(false);
    useCreateFromQuery(() => setCreateOpen(true)); // mobile quick-add → open New Stock Take
    const [openId, setOpenId] = useState<string | null>(null);

    const whName = useMemo(() => {
        const map = new Map((warehouses ?? []).map((w) => [w.id, w.name]));
        return (id: string) => map.get(id) ?? '—';
    }, [warehouses]);

    return (
        <SubscriptionGate feature="stock_tracking">
            <div className="p-4 sm:p-6 space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="mr-auto">
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <ClipboardCheck className="h-6 w-6" /> Stock Take
                            <InfoHint title="Stock take (physical count)" side="bottom">
                                Count physical stock against the system, then post the differences in one approved batch —
                                cleaner than editing items one by one. Use Adjustments for quick one-off corrections; use a
                                Stock Take for periodic full or cycle counts.
                            </InfoHint>
                        </h1>
                        <p className="text-muted-foreground mt-1">Physical counts with variance posting and supervisor sign-off</p>
                    </div>
                    {canAdd && (
                        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Stock Take</Button>
                    )}
                </div>

                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                                        <th className="px-6 py-3 text-left font-medium">Reference</th>
                                        <th className="px-6 py-3 text-left font-medium">Location</th>
                                        <th className="px-6 py-3 text-left font-medium">Status</th>
                                        <th className="px-6 py-3 text-left font-medium">Started</th>
                                        <th className="px-6 py-3" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {isLoading ? (
                                        <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Loading…</td></tr>
                                    ) : (counts ?? []).length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center">
                                                <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                                <p className="text-muted-foreground">No stock takes yet. Start one to count physical stock and post variances.</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        (counts as StockCount[]).map((c) => (
                                            <tr key={c.id} className="hover:bg-accent/30 cursor-pointer transition-colors" onClick={() => setOpenId(c.id)}>
                                                <td className="px-6 py-4 font-medium">{c.reference || <span className="text-muted-foreground">Untitled count</span>}</td>
                                                <td className="px-6 py-4">{whName(c.warehouse_id)}</td>
                                                <td className="px-6 py-4"><Badge variant={STATUS_VARIANT[c.status]}>{STATUS_LABEL[c.status]}</Badge></td>
                                                <td className="px-6 py-4 text-muted-foreground">{new Date(c.created_at).toLocaleDateString()}</td>
                                                <td className="px-6 py-4 text-right"><Button variant="ghost" size="sm">Open</Button></td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {createOpen && (
                <CreateCountDialog
                    orgSlug={orgSlug}
                    onClose={() => setCreateOpen(false)}
                    onCreated={(id) => { setCreateOpen(false); setOpenId(id); }}
                />
            )}
            {openId && (
                <CountDetailSheet
                    orgSlug={orgSlug}
                    countId={openId}
                    onClose={() => setOpenId(null)}
                    canChange={canChange}
                    canApprove={canApprove}
                />
            )}
        </SubscriptionGate>
    );
}
