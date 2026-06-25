'use client';

import { Badge, Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { GoodsReceiptDialog } from '@/components/inventory/GoodsReceiptDialog';
import { DetailDrawer } from '@/components/inventory/DetailDrawer';
import { RowActions } from '@/components/inventory/RowActions';
import { useGoodsReceipts, useGoodsReceipt, usePostGoodsReceipt } from '@/hooks/useGoodsReceipts';
import { usePurchaseOrders } from '@/hooks/usePurchaseOrders';
import { type GRNStatus } from '@/lib/api/goods-receipts';
import { AlertTriangle, ClipboardCheck, Plus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';
import { usePermissions, P } from '@/hooks/usePermissions';

const ITEMS_PER_PAGE = 20;
const STATUS_VARIANT: Record<GRNStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    draft: 'warning', posted: 'success', cancelled: 'error',
};

export default function GoodsReceiptsPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const [status, setStatus] = useState<GRNStatus | ''>('');
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState(false);
    const [viewId, setViewId] = useState<string | null>(null);

    const { data, isLoading, isError, refetch } = useGoodsReceipts(org, { status: status || undefined, page, limit: ITEMS_PER_PAGE });
    const post = usePostGoodsReceipt(org);
    const { data: orders } = usePurchaseOrders(org);
    const { data: viewGRN } = useGoodsReceipt(org, viewId ?? '');

    const { canAny } = usePermissions();
    const canAdd = canAny([P.PURCHASES_ADD, P.PURCHASES_MANAGE]);
    const canChange = canAny([P.PURCHASES_CHANGE, P.PURCHASES_MANAGE]);

    const rows = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE));
    useMemo(() => { setPage(1); }, [status]);
    const poNumberOf = (id: string) => (orders ?? []).find((o) => o.id === id)?.po_number ?? id.slice(0, 8);

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
                <CardHeader>
                    <select className="border border-border rounded-md px-3 py-2 text-sm bg-background w-fit" value={status} onChange={(e) => setStatus(e.target.value as GRNStatus | '')}>
                        <option value="">All statuses</option>
                        {(['draft', 'posted', 'cancelled'] as GRNStatus[]).map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">GRN #</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Purchase Order</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Received</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading…</td></tr>}
                                {!isLoading && isError && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                                            <p className="text-muted-foreground">Couldn&apos;t load goods receipts</p>
                                            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                        </td>
                                    </tr>
                                )}
                                {!isLoading && !isError && rows.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <ClipboardCheck className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No goods receipts yet</p>
                                        </td>
                                    </tr>
                                )}
                                {rows.map((g) => (
                                    <tr key={g.id} className="border-b border-border hover:bg-muted/20 cursor-pointer" onClick={() => setViewId(g.id)}>
                                        <td className="px-6 py-3 font-medium font-mono text-xs">{g.grn_number}</td>
                                        <td className="px-6 py-3 hidden md:table-cell font-mono text-xs">{poNumberOf(g.purchase_order_id)}</td>
                                        <td className="px-6 py-3"><Badge variant={STATUS_VARIANT[g.status]}>{g.status}</Badge></td>
                                        <td className="px-6 py-3 hidden lg:table-cell text-muted-foreground">{g.received_date ? new Date(g.received_date).toLocaleDateString() : '—'}</td>
                                        <td className="px-6 py-3">
                                            <RowActions
                                                onView={() => setViewId(g.id)}
                                                extra={canChange && g.status === 'draft' && (
                                                    <Button variant="outline" size="sm" disabled={post.isPending} onClick={(e: React.MouseEvent) => { e.stopPropagation(); post.mutate(g.id, { onSuccess: () => toast.success('GRN posted — stock updated'), onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to post GRN')) }); }}>Post</Button>
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
                actions={viewGRN && canChange && viewGRN.status === 'draft' && (
                    <Button size="sm" disabled={post.isPending} onClick={() => post.mutate(viewGRN.id, { onSuccess: () => { toast.success('GRN posted — stock updated'); setViewId(null); }, onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to post GRN')) })}>Post — update stock</Button>
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
                                            <td className="px-3 py-2 font-mono text-xs">{l.item_id.slice(0, 8)}</td>
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
        </div>
    );
}
