'use client';

import { Badge, Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { BatchFormDialog } from '@/components/inventory/BatchFormDialog';
import {
    useProductionBatches, useCreateBatch, useStartBatch, useCompleteBatch, useCancelBatch,
} from '@/hooks/useProductionBatches';
import { type CreateBatchInput, type ProductionBatch, type BatchStatus } from '@/lib/api/productionBatches';
import { AlertTriangle, BarChart3, Factory, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';

const ITEMS_PER_PAGE = 20;

const STATUS_VARIANT: Record<BatchStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    planned: 'outline', in_progress: 'warning', completed: 'success', cancelled: 'error', failed: 'error',
};

const STATUSES: BatchStatus[] = ['planned', 'in_progress', 'completed', 'cancelled', 'failed'];

export default function ProductionBatchesPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [status, setStatus] = useState<BatchStatus | ''>('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);

    const { data, isLoading, isError, refetch } = useProductionBatches(orgSlug, { status: status || undefined, page, limit: ITEMS_PER_PAGE });
    const createBatch = useCreateBatch(orgSlug);
    const startBatch = useStartBatch(orgSlug);
    const completeBatch = useCompleteBatch(orgSlug);
    const cancelBatch = useCancelBatch(orgSlug);

    const { canAny } = usePermissions();
    const canAdd = canAny([P.CATALOG_ADD, P.CATALOG_MANAGE]);
    const canChange = canAny([P.CATALOG_CHANGE, P.CATALOG_MANAGE]);

    const rows = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE));
    useMemo(() => { setPage(1); }, [status]);

    function act(label: string, p: Promise<unknown>) {
        p.then(() => toast.success(label)).catch(() => toast.error(`Failed to ${label.toLowerCase()}`));
    }

    function handleSubmit(input: CreateBatchInput) {
        createBatch.mutate(input, {
            onSuccess: () => { toast.success('Batch created'); setDialogOpen(false); },
            onError: () => toast.error('Failed to create batch'),
        });
    }

    function handleComplete(r: ProductionBatch) {
        const entered = window.prompt('Actual quantity produced:', String(r.planned_quantity));
        if (entered == null) return;
        const qty = Number(entered);
        if (!Number.isFinite(qty) || qty < 0) { toast.error('Invalid quantity'); return; }
        act('Completed', completeBatch.mutateAsync({ id: r.id, actualQuantity: qty }));
    }

    function handleCancel(r: ProductionBatch) {
        const reason = window.prompt('Reason for cancellation:');
        if (!reason) return;
        act('Cancelled', cancelBatch.mutateAsync({ id: r.id, reason }));
    }

    function workflowActions(r: ProductionBatch) {
        if (!canChange) return null;
        return (
            <div className="flex gap-2 justify-end">
                {r.status === 'planned' && <Button variant="outline" onClick={() => act('Started', startBatch.mutateAsync({ id: r.id }))}>Start</Button>}
                {r.status === 'in_progress' && (
                    <>
                        <Button onClick={() => handleComplete(r)}>Complete</Button>
                        <Button variant="outline" onClick={() => handleCancel(r)}>Cancel</Button>
                    </>
                )}
                {r.status === 'planned' && <Button variant="outline" onClick={() => handleCancel(r)}>Cancel</Button>}
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Factory className="h-6 w-6" /> Production Batches</h1>
                    <p className="text-muted-foreground mt-1">Manufacturing runs, raw-material consumption &amp; finished-goods output</p>
                </div>
                <div className="flex gap-2">
                    <Link href={`/${orgSlug}/production-batches/analytics`}><Button variant="outline"><BarChart3 className="h-4 w-4 mr-2" /> Analytics</Button></Link>
                    {canAdd && <Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Batch</Button>}
                </div>
            </div>

            <Card>
                <CardHeader>
                    <select className="border border-border rounded-md px-3 py-2 text-sm bg-background"
                        value={status} onChange={(e) => setStatus(e.target.value as BatchStatus | '')}>
                        <option value="">All statuses</option>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Batch #</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Scheduled</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Planned</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Actual</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading && <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading…</td></tr>}
                                {!isLoading && isError && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                                            <p className="text-muted-foreground">Couldn&apos;t load production batches</p>
                                            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                        </td>
                                    </tr>
                                )}
                                {!isLoading && !isError && rows.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <Factory className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No production batches yet</p>
                                        </td>
                                    </tr>
                                )}
                                {!isError && rows.map((r) => (
                                    <tr key={r.id} className="border-b border-border hover:bg-muted/20">
                                        <td className="px-6 py-3 font-medium">{r.batch_number}</td>
                                        <td className="px-6 py-3 hidden lg:table-cell">{r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString() : '—'}</td>
                                        <td className="px-6 py-3 text-right">{r.planned_quantity}</td>
                                        <td className="px-6 py-3 text-right hidden md:table-cell">{r.actual_quantity ?? '—'}</td>
                                        <td className="px-6 py-3"><Badge variant={STATUS_VARIANT[r.status]}>{r.status.replace(/_/g, ' ')}</Badge></td>
                                        <td className="px-6 py-3">
                                            <div className="flex gap-2 justify-end items-center">
                                                <Link href={`/${orgSlug}/production-batches/${r.id}`}><Button variant="outline" size="sm">View</Button></Link>
                                                {workflowActions(r)}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {totalPages > 1 && <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>}
                </CardContent>
            </Card>

            {dialogOpen && (
                <BatchFormDialog isPending={createBatch.isPending} onSubmit={handleSubmit} onClose={() => setDialogOpen(false)} />
            )}
        </div>
    );
}
