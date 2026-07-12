'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import {
    useRFQ,
    useRFQComparison,
    useInviteRFQSuppliers,
    useRemoveRFQSupplier,
    useSendRFQ,
    useCaptureRFQQuote,
    useDeclineRFQResponse,
    useAwardRFQ,
    useConvertRFQToPOs,
    useDeleteRFQ,
} from '@/hooks/useRFQs';
import { useSuppliers } from '@/hooks/useSuppliers';
import { usePermissions, P } from '@/hooks/usePermissions';
import type { AwardEntry, SupplierResponse } from '@/lib/api/rfq';
import { apiErrorMessage } from '@/lib/api/error-message';
import { ArrowLeft, Award, CheckCircle2, FileQuestion, Send, Trash2, Truck, X } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { DECIMAL_STEP, parseDecimal } from '@/lib/utils';

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    draft: 'outline', sent: 'default', closed: 'warning', awarded: 'success', cancelled: 'error',
};
const RESP_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    invited: 'outline', submitted: 'success', declined: 'error',
};

interface QuoteRow { unit_price: string; lead_time_days: string; available: boolean; }

export default function RFQDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;
    const rfqID = params?.rfqID as string;

    const { data: rfq, isLoading } = useRFQ(orgSlug, rfqID);
    const { data: suppliersPage } = useSuppliers(orgSlug);
    const suppliers = suppliersPage?.data ?? [];

    const hasSubmitted = (rfq?.responses ?? []).some((r) => r.status === 'submitted');
    const { data: comparison } = useRFQComparison(orgSlug, rfqID, hasSubmitted);

    const invite = useInviteRFQSuppliers(orgSlug, rfqID);
    const removeSupplier = useRemoveRFQSupplier(orgSlug, rfqID);
    const send = useSendRFQ(orgSlug, rfqID);
    const captureQuote = useCaptureRFQQuote(orgSlug, rfqID);
    const decline = useDeclineRFQResponse(orgSlug, rfqID);
    const awardRFQ = useAwardRFQ(orgSlug, rfqID);
    const convert = useConvertRFQToPOs(orgSlug, rfqID);
    const removeRFQ = useDeleteRFQ(orgSlug);

    const { canAny } = usePermissions();
    const canChange = canAny([P.PURCHASES_CHANGE, P.PURCHASES_MANAGE, P.APPROVALS_MANAGE]);
    const canDelete = canAny([P.PURCHASES_DELETE, P.PURCHASES_MANAGE]);

    // Invite picker
    const [inviteOpen, setInviteOpen] = useState(false);
    const [picked, setPicked] = useState<Record<string, boolean>>({});

    // Quote capture
    const [quoteResp, setQuoteResp] = useState<SupplierResponse | null>(null);
    const [quoteRows, setQuoteRows] = useState<Record<string, QuoteRow>>({});

    // Award selection: rfq_line_id -> supplier_id
    const [awardSel, setAwardSel] = useState<Record<string, string>>({});

    const invitedSupplierIds = useMemo(
        () => new Set((rfq?.responses ?? []).map((r) => r.supplier_id)),
        [rfq],
    );

    if (isLoading || !rfq) {
        return <div className="p-6 text-muted-foreground">Loading RFQ...</div>;
    }

    const isDraft = rfq.status === 'draft';
    const isCancelled = rfq.status === 'cancelled';
    const unconvertedAwards = (rfq.awards ?? []).filter((a) => !a.po_id);
    const canConvert = (rfq.awards ?? []).length > 0 && unconvertedAwards.length > 0;

    function openQuote(resp: SupplierResponse) {
        const rows: Record<string, QuoteRow> = {};
        for (const line of rfq?.lines ?? []) {
            const existing = resp.quoted_items?.find((q) => q.rfq_line_id === line.id);
            rows[line.id] = {
                unit_price: existing ? String(existing.unit_price) : '',
                lead_time_days: existing ? String(existing.lead_time_days) : '',
                available: existing ? existing.available : true,
            };
        }
        setQuoteRows(rows);
        setQuoteResp(resp);
    }

    function submitQuote() {
        if (!quoteResp) return;
        const items = Object.entries(quoteRows)
            .filter(([, v]) => v.unit_price !== '')
            .map(([rfq_line_id, v]) => ({
                rfq_line_id,
                unit_price: parseDecimal(v.unit_price),
                lead_time_days: parseInt(v.lead_time_days, 10) || 0,
                available: v.available,
            }));
        if (items.length === 0) { toast.error('Enter at least one price'); return; }
        captureQuote.mutate(
            { responseId: quoteResp.id, data: { items } },
            {
                onSuccess: () => { toast.success('Quote saved'); setQuoteResp(null); },
                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to save quote')),
            },
        );
    }

    function doInvite() {
        const ids = Object.entries(picked).filter(([, v]) => v).map(([k]) => k);
        if (ids.length === 0) { toast.error('Select at least one supplier'); return; }
        invite.mutate(ids, {
            onSuccess: (res) => { toast.success(`${res.invited} supplier(s) invited`); setInviteOpen(false); setPicked({}); },
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to invite suppliers')),
        });
    }

    function doAward() {
        const awards: AwardEntry[] = [];
        for (const line of comparison?.lines ?? []) {
            const sid = awardSel[line.rfq_line_id];
            if (!sid) continue;
            const quote = line.quotes.find((q) => q.supplier_id === sid);
            if (!quote) continue;
            awards.push({ rfq_line_id: line.rfq_line_id, supplier_id: sid, unit_price: quote.unit_price, quantity: line.quantity });
        }
        if (awards.length === 0) { toast.error('Select a winning supplier for at least one line'); return; }
        awardRFQ.mutate(awards, {
            onSuccess: () => toast.success('Awards recorded'),
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to record awards')),
        });
    }

    function doConvert() {
        convert.mutate(rfq?.warehouse_id, {
            onSuccess: (res) => toast.success(`${res.count} purchase order(s) created`),
            onError: (e: unknown) => {
                const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
                toast.error(msg || 'Failed to convert to POs');
            },
        });
    }

    return (
        <>
            <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/${orgSlug}/rfqs`)}>
                        <ArrowLeft className="h-4 w-4 mr-2" /> Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <FileQuestion className="h-5 w-5" /> {rfq.rfq_number}
                        </h1>
                        <p className="text-muted-foreground text-sm">{rfq.title || 'Request for Quotation'}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[rfq.status] ?? 'default'} className="ml-1">{rfq.status}</Badge>
                    <div className="ml-auto flex flex-wrap gap-2">
                        {canChange && isDraft && (
                            <Button size="sm" disabled={send.isPending} onClick={() => send.mutate(undefined, {
                                onSuccess: () => toast.success('RFQ sent to suppliers'),
                                onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Failed to send'),
                            })}>
                                <Send className="h-4 w-4 mr-2" /> Send to Suppliers
                            </Button>
                        )}
                        {canChange && hasSubmitted && (
                            <Button size="sm" variant="outline" disabled={awardRFQ.isPending} onClick={doAward}>
                                <Award className="h-4 w-4 mr-2" /> Award Selected
                            </Button>
                        )}
                        {canChange && canConvert && (
                            <Button size="sm" disabled={convert.isPending} onClick={doConvert}>
                                <Truck className="h-4 w-4 mr-2" /> Convert to POs
                            </Button>
                        )}
                        {canDelete && (
                            <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => {
                                    if (!confirm('Delete this RFQ?')) return;
                                    removeRFQ.mutate(rfq.id, {
                                        onSuccess: () => { toast.success('RFQ deleted'); router.push(`/${orgSlug}/rfqs`); },
                                        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to delete RFQ')),
                                    });
                                }}>
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Requested lines */}
                <Card>
                    <CardHeader><h2 className="text-lg font-semibold">Requested Items</h2></CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Item / Description</th>
                                        <th className="text-right px-6 py-3 font-medium text-muted-foreground">Qty</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">UoM</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {(rfq.lines ?? []).map((l) => (
                                        <tr key={l.id}>
                                            <td className="px-6 py-3">{l.item_name || l.description || '—'}</td>
                                            <td className="px-6 py-3 text-right tabular-nums">{l.quantity}</td>
                                            <td className="px-6 py-3 text-muted-foreground">{l.uom || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>

                {/* Suppliers */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Suppliers</h2>
                            {canChange && !isCancelled && (
                                <Button size="sm" variant="outline" onClick={() => { setPicked({}); setInviteOpen(true); }}>
                                    <Truck className="h-4 w-4 mr-2" /> Invite Suppliers
                                </Button>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {(rfq.responses ?? []).length === 0 ? (
                            <p className="px-6 py-8 text-center text-muted-foreground">No suppliers invited yet.</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/30">
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Supplier</th>
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Quote Total</th>
                                            <th className="px-6 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(rfq.responses ?? []).map((resp) => (
                                            <tr key={resp.id}>
                                                <td className="px-6 py-3 font-medium">{resp.supplier_name || resp.supplier_id.slice(0, 8)}</td>
                                                <td className="px-6 py-3"><Badge variant={RESP_VARIANT[resp.status] ?? 'outline'}>{resp.status}</Badge></td>
                                                <td className="px-6 py-3 text-right tabular-nums">{resp.status === 'submitted' ? `${resp.currency} ${resp.total.toLocaleString()}` : '—'}</td>
                                                <td className="px-6 py-3 text-right whitespace-nowrap">
                                                    {canChange && resp.status !== 'declined' && (
                                                        <Button size="sm" variant="ghost" onClick={() => openQuote(resp)}>
                                                            {resp.status === 'submitted' ? 'Edit Quote' : 'Enter Quote'}
                                                        </Button>
                                                    )}
                                                    {canChange && resp.status === 'invited' && (
                                                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                                                            onClick={() => decline.mutate(resp.id, { onSuccess: () => toast.success('Marked declined'), onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed')) })}>
                                                            Decline
                                                        </Button>
                                                    )}
                                                    {canChange && resp.status === 'invited' && (
                                                        <Button size="sm" variant="ghost" className="text-muted-foreground"
                                                            onClick={() => removeSupplier.mutate(resp.id, { onSuccess: () => toast.success('Removed'), onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed')) })}>
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Comparison matrix + award selection */}
                {comparison && comparison.lines.length > 0 && hasSubmitted && (
                    <Card>
                        <CardHeader><h2 className="text-lg font-semibold">Quote Comparison</h2></CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/30">
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Line</th>
                                            {comparison.suppliers.filter((s) => s.status === 'submitted').map((s) => (
                                                <th key={s.supplier_id} className="text-right px-4 py-3 font-medium text-muted-foreground">{s.supplier_name || s.supplier_id.slice(0, 6)}</th>
                                            ))}
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Award to</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {comparison.lines.map((line) => {
                                            const submittedSuppliers = comparison.suppliers.filter((s) => s.status === 'submitted');
                                            const selected = awardSel[line.rfq_line_id] ?? line.best_supplier_id ?? '';
                                            return (
                                                <tr key={line.rfq_line_id}>
                                                    <td className="px-6 py-3">
                                                        <div className="font-medium">{line.item_name || line.description || '—'}</div>
                                                        <div className="text-xs text-muted-foreground">x{line.quantity}</div>
                                                    </td>
                                                    {submittedSuppliers.map((s) => {
                                                        const q = line.quotes.find((x) => x.supplier_id === s.supplier_id);
                                                        const isBest = line.best_supplier_id === s.supplier_id;
                                                        return (
                                                            <td key={s.supplier_id} className={'px-4 py-3 text-right tabular-nums ' + (isBest ? 'text-emerald-600 font-semibold' : '')}>
                                                                {q ? (
                                                                    <>
                                                                        {q.unit_price.toLocaleString()}
                                                                        {!q.available && <span className="block text-[10px] text-rose-500">unavailable</span>}
                                                                        {isBest && <CheckCircle2 className="inline h-3 w-3 ml-1" />}
                                                                    </>
                                                                ) : '—'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="px-6 py-3">
                                                        <select
                                                            value={selected}
                                                            onChange={(e) => setAwardSel({ ...awardSel, [line.rfq_line_id]: e.target.value })}
                                                            className="rounded-lg border border-input bg-transparent px-3 py-1.5 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                                        >
                                                            <option value="">— none —</option>
                                                            {submittedSuppliers.map((s) => (
                                                                <option key={s.supplier_id} value={s.supplier_id}>{s.supplier_name || s.supplier_id.slice(0, 6)}</option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t border-border bg-muted/20 font-semibold">
                                            <td className="px-6 py-3">Grand Total</td>
                                            {comparison.suppliers.filter((s) => s.status === 'submitted').map((s) => (
                                                <td key={s.supplier_id} className="px-4 py-3 text-right tabular-nums">{s.grand_total.toLocaleString()}</td>
                                            ))}
                                            <td></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Awards */}
                {(rfq.awards ?? []).length > 0 && (
                    <Card>
                        <CardHeader><h2 className="text-lg font-semibold">Awards</h2></CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/30">
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Line</th>
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Supplier</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Unit Price</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Qty</th>
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">PO</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(rfq.awards ?? []).map((a) => {
                                            const line = (rfq.lines ?? []).find((l) => l.id === a.rfq_line_id);
                                            return (
                                                <tr key={a.id}>
                                                    <td className="px-6 py-3">{line?.item_name || line?.description || a.rfq_line_id.slice(0, 8)}</td>
                                                    <td className="px-6 py-3">{a.supplier_name || a.supplier_id.slice(0, 8)}</td>
                                                    <td className="px-6 py-3 text-right tabular-nums">{a.unit_price.toLocaleString()}</td>
                                                    <td className="px-6 py-3 text-right tabular-nums">{a.quantity}</td>
                                                    <td className="px-6 py-3">{a.po_id ? <Badge variant="success">ordered</Badge> : <Badge variant="outline">pending</Badge>}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Invite dialog */}
            {inviteOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setInviteOpen(false)} />
                    <div className="relative z-50 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">Invite Suppliers</h2>
                                    <button onClick={() => setInviteOpen(false)} className="p-1 rounded-lg hover:bg-accent transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {suppliers.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No suppliers found. Add suppliers first.</p>
                                ) : (
                                    <div className="space-y-1 max-h-72 overflow-y-auto">
                                        {suppliers.map((s) => {
                                            const already = invitedSupplierIds.has(s.id);
                                            return (
                                                <label key={s.id} className={'flex items-center gap-3 p-2 rounded-lg ' + (already ? 'opacity-50' : 'hover:bg-accent/40 cursor-pointer')}>
                                                    <input
                                                        type="checkbox"
                                                        disabled={already}
                                                        checked={already || !!picked[s.id]}
                                                        onChange={(e) => setPicked({ ...picked, [s.id]: e.target.checked })}
                                                    />
                                                    <span className="text-sm">{s.name}{already && <span className="text-xs text-muted-foreground"> (invited)</span>}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                                <div className="flex gap-3 pt-2">
                                    <Button variant="outline" className="flex-1" onClick={() => setInviteOpen(false)}>Cancel</Button>
                                    <Button className="flex-1" disabled={invite.isPending} onClick={doInvite}>{invite.isPending ? 'Inviting...' : 'Invite'}</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Quote capture dialog */}
            {quoteResp && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setQuoteResp(null)} />
                    <div className="relative z-50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">Quote — {quoteResp.supplier_name || 'Supplier'}</h2>
                                    <button onClick={() => setQuoteResp(null)} className="p-1 rounded-lg hover:bg-accent transition-colors"><X className="h-5 w-5 text-muted-foreground" /></button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {(rfq.lines ?? []).map((line) => {
                                    const row = quoteRows[line.id] ?? { unit_price: '', lead_time_days: '', available: true };
                                    return (
                                        <div key={line.id} className="p-3 rounded-lg border border-border space-y-2">
                                            <div className="text-sm font-medium">{line.item_name || line.description || '—'} <span className="text-muted-foreground">x{line.quantity}</span></div>
                                            <div className="grid grid-cols-3 gap-2 items-end">
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Unit Price</label>
                                                    <Input type="number" min="0" step={DECIMAL_STEP} value={row.unit_price}
                                                        onChange={(e) => setQuoteRows({ ...quoteRows, [line.id]: { ...row, unit_price: e.target.value } })} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs text-muted-foreground">Lead (days)</label>
                                                    <Input type="number" min="0" value={row.lead_time_days}
                                                        onChange={(e) => setQuoteRows({ ...quoteRows, [line.id]: { ...row, lead_time_days: e.target.value } })} />
                                                </div>
                                                <label className="flex items-center gap-2 text-sm pb-2">
                                                    <input type="checkbox" checked={row.available}
                                                        onChange={(e) => setQuoteRows({ ...quoteRows, [line.id]: { ...row, available: e.target.checked } })} />
                                                    In stock
                                                </label>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="flex gap-3 pt-2">
                                    <Button variant="outline" className="flex-1" onClick={() => setQuoteResp(null)}>Cancel</Button>
                                    <Button className="flex-1" disabled={captureQuote.isPending} onClick={submitQuote}>{captureQuote.isPending ? 'Saving...' : 'Save Quote'}</Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </>
    );
}
