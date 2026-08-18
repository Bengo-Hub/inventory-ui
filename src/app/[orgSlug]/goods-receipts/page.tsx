'use client';

import { Badge, Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { GoodsReceiptDialog } from '@/components/inventory/GoodsReceiptDialog';
import { DetailDrawer } from '@/components/inventory/DetailDrawer';
import { DocFormatMenu, type DocFormat } from '@/components/inventory/DocFormatMenu';
import { downloadBlob } from '@/components/inventory/ExportDialogs';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { useGoodsReceipts, useGoodsReceipt, usePostGoodsReceipt } from '@/hooks/useGoodsReceipts';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { type GRNStatus } from '@/lib/api/goods-receipts';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildGoodsReceiptColumns, STATUS_VARIANT } from './goods-receipt-columns';
import { ClipboardCheck, Plus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiClient } from '@/lib/api/client';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';

export default function GoodsReceiptsPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const [status, setStatus] = useState<GRNStatus | ''>('');
    const [range, setRange] = useState<DateRange>({ from: '', to: '' });
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [open, setOpen] = useState(false);
    const [viewId, setViewId] = useState<string | null>(null);

    const { data, isLoading, isError, refetch } = useGoodsReceipts(org, { status: status || undefined, from: range.from || undefined, to: range.to || undefined, page, limit: pageSize });
    const post = usePostGoodsReceipt(org);
    // Only used to resolve PO numbers for display — pull the max page size rather than
    // paginating, since this isn't a user-facing list of purchase orders.
    const { data: ordersPage } = usePurchaseOrders(org, { limit: 100 });
    const orders = ordersPage?.data;
    const { data: viewGRN } = useGoodsReceipt(org, viewId ?? '');

    const { canAny } = usePermissions();
    const canAdd = canAny([P.PURCHASES_ADD, P.PURCHASES_MANAGE]);
    const canChange = canAny([P.PURCHASES_CHANGE, P.PURCHASES_MANAGE]);

    const rows = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
    useMemo(() => { setPage(1); }, [status, range, pageSize]);
    const poNumberOf = (id: string) => (orders ?? []).find((o) => o.id === id)?.po_number ?? id.slice(0, 8);

    function handlePost(id: string) {
        post.mutate(id, {
            onSuccess: () => toast.success('GRN posted — stock updated'),
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to post GRN')),
        });
    }

    // Document preview (Print/Export) — same shared-ui-lib PDF previewer as Purchase Orders,
    // streaming inventory-api's GET /goods-receipts/{id}/pdf. This was the confirmed real gap:
    // the PO-receiving GRN had a number and a concept but no printable document at all.
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function previewGRN(g: { id: string; grn_number: string }, format: DocFormat = 'pdf') {
        const url = `/api/v1/${org}/inventory/goods-receipts/${g.id}/pdf`;
        if (format === 'pdf') {
            openPreview(() => apiClient.getBlob(url, { format }), { fileName: `${g.grn_number}.pdf`, title: g.grn_number });
            return;
        }
        apiClient.getBlob(url, { format })
            .then((blob) => downloadBlob(blob, `${g.grn_number}.${format}`))
            .catch(() => toast.error('Could not export goods receipt. Please try again.'));
    }

    const columns = useMemo(
        () => buildGoodsReceiptColumns({
            canChange,
            isPosting: post.isPending,
            poNumberOf,
            onView: (g) => setViewId(g.id),
            onPost: (g) => handlePost(g.id),
            onPrint: (g) => previewGRN(g),
        }),
        [canChange, post.isPending, orders],
    );

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ClipboardCheck className="h-6 w-6" /> Goods Receipts</h1>
                    <p className="text-muted-foreground mt-1">Receive goods against purchase orders (GRN) &amp; 3-way match</p>
                </div>
                {canAdd && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Goods Receipt</Button>}
            </div>

            <Card>
                <CardHeader className="flex flex-row flex-wrap items-center gap-2">
                    <select className="border border-border rounded-md px-3 py-2 text-sm bg-background w-fit" value={status} onChange={(e) => setStatus(e.target.value as GRNStatus | '')}>
                        <option value="">All statuses</option>
                        {(['draft', 'posted', 'cancelled'] as GRNStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <DateRangePicker value={range} onChange={setRange} className="w-56" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable
                            columns={columns}
                            rows={rows}
                            rowKey={(g) => g.id}
                            loading={isLoading}
                            error={isError}
                            onRetry={() => refetch()}
                            onRowClick={(g) => setViewId(g.id)}
                            emptyText="No goods receipts yet"
                            storageKey="goods-receipts-col-prefs"
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

            {open && <GoodsReceiptDialog org={org} onClose={() => setOpen(false)} onCreated={() => setOpen(false)} />}

            <DetailDrawer
                open={!!viewId}
                onClose={() => setViewId(null)}
                loading={!!viewId && !viewGRN}
                title={viewGRN?.grn_number ?? 'Goods Receipt'}
                subtitle={viewGRN ? poNumberOf(viewGRN.purchase_order_id) : undefined}
                badges={viewGRN && <Badge variant={STATUS_VARIANT[viewGRN.status]}>{viewGRN.status}</Badge>}
                fields={viewGRN ? [
                    { label: 'Purchase Order', value: poNumberOf(viewGRN.purchase_order_id) },
                    { label: 'Received', value: viewGRN.received_date ? new Date(viewGRN.received_date).toLocaleDateString() : '—' },
                    { label: 'Notes', value: viewGRN.notes, full: true, hideIfEmpty: true },
                ] : []}
                actions={viewGRN && (
                    <>
                        <DocFormatMenu label="Print / Export" onSelect={(format) => previewGRN(viewGRN, format)} />
                        {canChange && viewGRN.status === 'draft' && (
                            <Button size="sm" disabled={post.isPending} onClick={() => post.mutate(viewGRN.id, { onSuccess: () => { toast.success('GRN posted — stock updated'); setViewId(null); }, onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to post GRN')) })}>Post — update stock</Button>
                        )}
                    </>
                )}
            >
                {viewGRN && (viewGRN.lines?.length ?? 0) > 0 && (
                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold">Received Lines</h3>
                        <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-3 py-2 font-medium text-muted-foreground">Item</th>
                                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Received</th>
                                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Accepted</th>
                                        <th className="text-right px-3 py-2 font-medium text-muted-foreground">Rejected</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {viewGRN.lines?.map((l, i) => (
                                        <tr key={l.id ?? i}>
                                            <td className="px-3 py-2">
                                                <span className="block font-medium" title={l.item_id}>{l.item_name || l.item_id.slice(0, 8)}</span>
                                                {(l.sku || l.barcode || (l.serials?.length ?? 0) > 0) && (
                                                    <span className="block text-[11px] text-muted-foreground font-mono">
                                                        {[l.sku, l.barcode, l.serials?.join(', ')].filter(Boolean).join(' · ')}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2 text-right tabular-nums">{l.quantity_received}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{l.quantity_accepted}</td>
                                            <td className="px-3 py-2 text-right tabular-nums">{l.quantity_rejected}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </DetailDrawer>

            <PdfPreview {...previewProps} />
        </div>
    );
}
