'use client';

import { Badge, Button, Card, CardContent, Input } from '@/components/ui/base';
import { InfoHint } from '@/components/ui/info-hint';
import { Pagination } from '@/components/ui/pagination';
import { BarcodeScanButton } from '@/components/inventory/BarcodeScanner';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { SubscriptionGate } from '@/components/subscription/subscription-gate';
import { useWarehouses } from '@/hooks/useWarehouses';
import {
    useApproveStockCount,
    useCancelStockCount,
    useStockCount,
    useSubmitStockCount,
    useUpsertCountLine,
} from '@/hooks/useStockCounts';
import { usePermissions, P } from '@/hooks/usePermissions';
import { VARIANCE_REASONS, type StockCountLine, type StockCountStatus } from '@/lib/api/stock-counts';
import { apiErrorMessage } from '@/lib/api/error-message';
import { apiClient } from '@/lib/api/client';
import { ArrowLeft, CheckCircle2, ScanBarcode, Search, Send } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

const STATUS_VARIANT: Record<StockCountStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    draft: 'outline', counting: 'warning', review: 'default', approved: 'success', cancelled: 'error',
};
const STATUS_LABEL: Record<StockCountStatus, string> = {
    draft: 'Draft', counting: 'Counting', review: 'In Review', approved: 'Approved', cancelled: 'Cancelled',
};

const LINES_PER_PAGE = 25;

/** Counts keep 4 decimal places (fractional kg/L are normal). */
function round4(v: number): number {
    return Math.round(v * 10000) / 10000;
}
function fmtQty(v: number | null | undefined): string {
    if (v == null) return '—';
    return String(round4(v));
}

// ── Line row ────────────────────────────────────────────────────────────────────

function CountLineRow({ orgSlug, countId, line, editable, canClassify, flash }: {
    orgSlug: string;
    countId: string;
    line: StockCountLine;
    editable: boolean;
    /** Reason dropdown enabled (counting or review, with change permission). */
    canClassify: boolean;
    /** True briefly after a scan hit this line — highlights the row. */
    flash: boolean;
}) {
    const upsert = useUpsertCountLine(orgSlug, countId);
    const [value, setValue] = useState(line.counted_qty != null ? String(line.counted_qty) : '');

    // A scan (or another device) may update the line server-side — resync the local
    // input whenever the fetched counted_qty diverges from what's typed here.
    useEffect(() => {
        const typed = value === '' ? null : parseFloat(value);
        if ((line.counted_qty ?? null) !== (typed == null || Number.isNaN(typed) ? null : typed)) {
            setValue(line.counted_qty != null ? String(line.counted_qty) : '');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [line.counted_qty]);

    const variance = value === '' ? null : round4(parseFloat(value) - line.system_qty);

    function save() {
        if (value === '') return;
        const counted = round4(parseFloat(value));
        if (Number.isNaN(counted) || counted === line.counted_qty) return;
        upsert.mutate(
            { item_id: line.item_id, sku: line.sku, counted_qty: counted },
            { onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to save line')) },
        );
    }

    function saveReason(reason: string) {
        upsert.mutate(
            { item_id: line.item_id, sku: line.sku, counted_qty: line.counted_qty ?? 0, reason },
            { onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to classify variance')) },
        );
    }

    const shownVariance = variance ?? line.variance;
    const counted = line.counted_qty != null || value !== '';

    return (
        <tr className={`border-b border-border last:border-0 transition-colors ${flash ? 'bg-primary/10' : ''}`}>
            <td className="px-3 py-2">
                <div className="font-medium text-sm leading-tight">{line.item_name || line.sku}</div>
                <div className="text-[11px] text-muted-foreground/70 font-mono leading-tight">{line.sku}</div>
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                {fmtQty(line.system_qty)}{line.unit ? <span className="text-[11px] ml-1">{line.unit}</span> : null}
            </td>
            <td className="px-3 py-2 text-right">
                {editable ? (
                    <div className="relative inline-block">
                        <Input
                            type="number"
                            step="0.0001"
                            min="0"
                            inputMode="decimal"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onBlur={save}
                            className={`h-8 w-28 text-right text-sm ${line.unit ? 'pr-8' : ''}`}
                            placeholder="—"
                        />
                        {line.unit && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">{line.unit}</span>
                        )}
                    </div>
                ) : (
                    <span className="tabular-nums">{fmtQty(line.counted_qty)}{line.unit && line.counted_qty != null ? <span className="text-[11px] text-muted-foreground ml-1">{line.unit}</span> : null}</span>
                )}
            </td>
            <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                {shownVariance == null ? (
                    <span className="text-muted-foreground">—</span>
                ) : (
                    <span className={shownVariance === 0 ? 'text-muted-foreground' : shownVariance > 0 ? 'text-emerald-600' : 'text-destructive'}>
                        {shownVariance > 0 ? '+' : ''}{fmtQty(shownVariance)}
                    </span>
                )}
            </td>
            <td className="px-3 py-2">
                {shownVariance != null && shownVariance !== 0 && !line.posted ? (
                    canClassify ? (
                        <select
                            value={line.reason || 'count_variance'}
                            onChange={(e) => saveReason(e.target.value)}
                            className="h-8 w-full min-w-36 rounded-lg border border-input bg-transparent px-2 text-xs focus:ring-1 focus:ring-ring focus:outline-none"
                            title="Classify this variance — becomes the stock adjustment reason on approval"
                        >
                            {VARIANCE_REASONS.map((r) => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    ) : (
                        <span className="text-xs text-muted-foreground">
                            {VARIANCE_REASONS.find((r) => r.value === (line.reason || 'count_variance'))?.label}
                        </span>
                    )
                ) : null}
            </td>
            <td className="px-3 py-2 text-center">
                {line.posted
                    ? <Badge variant="success">Posted</Badge>
                    : counted
                        ? <CheckCircle2 className="h-4 w-4 text-emerald-600 inline" aria-label="Counted" />
                        : <span className="text-xs text-muted-foreground">pending</span>}
            </td>
        </tr>
    );
}

// ── Page ────────────────────────────────────────────────────────────────────────

export default function StockTakeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;
    const countId = params?.id as string;

    const { data: count, isLoading, refetch } = useStockCount(orgSlug, countId);
    const { data: warehouses } = useWarehouses(orgSlug);
    const submit = useSubmitStockCount(orgSlug);
    const approve = useApproveStockCount(orgSlug);
    const cancel = useCancelStockCount(orgSlug);
    const addLine = useUpsertCountLine(orgSlug, countId);

    const { canAny } = usePermissions();
    const canChange = canAny([P.STOCK_COUNT_CHANGE, P.STOCK_MANAGE]);
    const canApprove = canAny([P.STOCK_COUNT_APPROVE, P.STOCK_MANAGE]);

    const status = count?.status;
    const editable = !!canChange && status === 'counting';
    const canClassify = !!canChange && (status === 'counting' || status === 'review');

    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [onlyUncounted, setOnlyUncounted] = useState(false);
    // Section filters — each team narrows the sheet to the categories/types they own
    // (kitchen → Raw Ingredients, bar → Beers/Spirits), fills their part, and the next
    // team filters to theirs; submit once every section is in.
    const [categoryFilter, setCategoryFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [flashId, setFlashId] = useState<string | null>(null);

    const lines = useMemo(() => count?.lines ?? [], [count?.lines]);

    const categoryOptions = useMemo(
        () => Array.from(new Set(lines.map((ln) => ln.category_name).filter(Boolean))).sort() as string[],
        [lines],
    );
    const typeOptions = useMemo(
        () => Array.from(new Set(lines.map((ln) => ln.item_type).filter(Boolean))).sort() as string[],
        [lines],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return lines.filter((ln) => {
            if (onlyUncounted && ln.counted_qty != null) return false;
            if (categoryFilter && (ln.category_name ?? '') !== categoryFilter) return false;
            if (typeFilter && (ln.item_type ?? '') !== typeFilter) return false;
            if (!q) return true;
            return (
                (ln.item_name ?? '').toLowerCase().includes(q) ||
                ln.sku.toLowerCase().includes(q) ||
                (ln.barcode ?? '').toLowerCase().includes(q)
            );
        });
    }, [lines, search, onlyUncounted, categoryFilter, typeFilter]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / LINES_PER_PAGE));
    const pageLines = filtered.slice((page - 1) * LINES_PER_PAGE, page * LINES_PER_PAGE);
    useEffect(() => { setPage(1); }, [search, onlyUncounted, categoryFilter, typeFilter]);

    const countedCount = lines.filter((ln) => ln.counted_qty != null).length;

    // ── Scan-to-count: match barcode OR sku; each scan adds 1 stock unit. Unknown
    // codes fall back to an item lookup so a scanned item can join the sheet. ──────
    async function handleScan(rawCode: string) {
        const code = rawCode.trim();
        if (!code || !editable) return;
        const lower = code.toLowerCase();
        const line = lines.find(
            (ln) => (ln.barcode && ln.barcode.toLowerCase() === lower) || ln.sku.toLowerCase() === lower,
        );
        if (line) {
            const next = round4((line.counted_qty ?? 0) + 1);
            addLine.mutate(
                { item_id: line.item_id, sku: line.sku, counted_qty: next },
                {
                    onSuccess: () => {
                        setFlashId(line.id);
                        setTimeout(() => setFlashId(null), 1200);
                        toast.success(`${line.item_name || line.sku}: counted ${next}${line.unit ? ' ' + line.unit : ''}`);
                    },
                    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to record scan')),
                },
            );
            return;
        }
        // Not on the sheet — look the code up in the catalog and add it.
        try {
            const res = await apiClient.get<{ data: { id: string; sku: string; name: string }[] } | { id: string; sku: string; name: string }[]>(
                `/api/v1/${orgSlug}/inventory/items`,
                { search: code },
            );
            const items = Array.isArray(res) ? res : (res as { data: { id: string; sku: string; name: string }[] }).data ?? [];
            const exact = items.find((i) => i.sku.toLowerCase() === lower) ?? items[0];
            if (!exact) {
                toast.error(`No item matches "${code}"`);
                return;
            }
            addLine.mutate(
                { item_id: exact.id, sku: exact.sku, counted_qty: 1 },
                {
                    onSuccess: () => toast.success(`${exact.name} added to the count (1 counted)`),
                    onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to add scanned item')),
                },
            );
        } catch {
            toast.error(`No item matches "${code}"`);
        }
    }

    const whName = useMemo(() => {
        const map = new Map((warehouses ?? []).map((w) => [w.id, w.name]));
        return (id?: string) => (id ? map.get(id) ?? '—' : '—');
    }, [warehouses]);

    return (
        <SubscriptionGate feature="stock_tracking">
            <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                    <button onClick={() => router.push(`/${orgSlug}/stock-take`)} className="text-muted-foreground hover:text-foreground" aria-label="Back to stock takes">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="mr-auto">
                        <h1 className="text-xl font-bold tracking-tight">
                            {count?.reference || 'Stock Take'}
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            {whName(count?.warehouse_id)}
                            {count ? ` · started ${new Date(count.created_at).toLocaleString()}` : ''}
                        </p>
                    </div>
                    {status && <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>}
                </div>

                {isLoading || !count ? (
                    <p className="text-sm text-muted-foreground py-12 text-center">Loading count…</p>
                ) : (
                    <>
                        {/* Progress + workflow hint */}
                        <div className="rounded-lg border border-border bg-accent/20 p-3 text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span>
                                <strong className="text-foreground">{countedCount}</strong> of{' '}
                                <strong className="text-foreground">{lines.length}</strong> items counted
                            </span>
                            <span className="hidden sm:inline">·</span>
                            <span>
                                Count while <em>Counting</em> → <em>Submit for review</em> → a manager/accountant{' '}
                                <em>Approves</em>, posting every variance as a stock adjustment with its classification.
                            </span>
                        </div>

                        {/* Scan-to-count */}
                        {editable && (
                            <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Scan barcode / SKU to count (+1 per scan) — or type and press Enter…"
                                        className="pl-10"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const v = (e.target as HTMLInputElement).value;
                                                (e.target as HTMLInputElement).value = '';
                                                void handleScan(v);
                                            }
                                        }}
                                    />
                                </div>
                                <BarcodeScanButton
                                    title="Scan with camera"
                                    hint="Point the camera at the item barcode — each scan counts one unit."
                                    onScan={(code) => void handleScan(code)}
                                />
                            </div>
                        )}

                        {/* Add item manually */}
                        {editable && (
                            <ItemSearchInput
                                orgSlug={orgSlug}
                                value=""
                                placeholder="Add an item to this count…"
                                enableScan={false}
                                onSelect={(item) =>
                                    addLine.mutate(
                                        { item_id: item.id, sku: item.sku, counted_qty: 0 },
                                        { onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to add item')) },
                                    )
                                }
                            />
                        )}

                        {/* Filter row — teams narrow to their section (category/type), count it,
                            then the next team filters to theirs; one submit covers all sections. */}
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative flex-1 min-w-52">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input placeholder="Filter by name, SKU or barcode…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
                            </div>
                            {categoryOptions.length > 0 && (
                                <select
                                    value={categoryFilter}
                                    onChange={(e) => setCategoryFilter(e.target.value)}
                                    className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                    title="Show only one category — count your section, others count theirs"
                                >
                                    <option value="">All categories</option>
                                    {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                            )}
                            {typeOptions.length > 1 && (
                                <select
                                    value={typeFilter}
                                    onChange={(e) => setTypeFilter(e.target.value)}
                                    className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                    title="Show only one item type"
                                >
                                    <option value="">All types</option>
                                    {typeOptions.map((t2) => <option key={t2} value={t2}>{t2}</option>)}
                                </select>
                            )}
                            <label className="flex items-center gap-2 text-sm cursor-pointer whitespace-nowrap">
                                <input type="checkbox" checked={onlyUncounted} onChange={(e) => setOnlyUncounted(e.target.checked)} className="rounded" />
                                Uncounted only
                            </label>
                        </div>

                        {/* Count sheet */}
                        <Card>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground">
                                                <th className="px-3 py-2 text-left font-medium">Item</th>
                                                <th className="px-3 py-2 text-right font-medium">
                                                    <span className="inline-flex items-center gap-1">System
                                                        <InfoHint title="Expected closing stock">What the system expects on hand from recorded transactions — the figure to count against.</InfoHint>
                                                    </span>
                                                </th>
                                                <th className="px-3 py-2 text-right font-medium">Counted</th>
                                                <th className="px-3 py-2 text-right font-medium">
                                                    <span className="inline-flex items-center gap-1">Variance
                                                        <InfoHint title="Variance">Counted − System. Positive = surplus, negative = shortage. Classify it, then approval posts it as a stock adjustment.</InfoHint>
                                                    </span>
                                                </th>
                                                <th className="px-3 py-2 text-left font-medium">Classification</th>
                                                <th className="px-3 py-2 text-center font-medium">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {pageLines.length === 0 ? (
                                                <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">
                                                    {lines.length === 0 ? 'No items on this count yet.' : 'No lines match the filter.'}
                                                </td></tr>
                                            ) : (
                                                pageLines.map((ln) => (
                                                    <CountLineRow
                                                        key={ln.id}
                                                        orgSlug={orgSlug}
                                                        countId={countId}
                                                        line={ln}
                                                        editable={editable}
                                                        canClassify={canClassify}
                                                        flash={flashId === ln.id}
                                                    />
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                {filtered.length > LINES_PER_PAGE && (
                                    <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                                )}
                            </CardContent>
                        </Card>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2">
                            {canChange && status === 'counting' && (
                                <Button
                                    onClick={() => submit.mutate(countId, {
                                        onSuccess: () => { toast.success('Submitted for review'); void refetch(); },
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
                                            else toast.success(`Approved · ${res.posted_lines ?? 0} variance adjustment(s) posted`);
                                            void refetch();
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
                                        onSuccess: () => { toast.success('Count cancelled'); router.push(`/${orgSlug}/stock-take`); },
                                        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to cancel')),
                                    })}
                                    disabled={cancel.isPending}
                                >
                                    Cancel count
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </SubscriptionGate>
    );
}
