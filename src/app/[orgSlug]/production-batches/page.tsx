'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { BatchFormDialog } from '@/components/inventory/BatchFormDialog';
import {
    useProductionBatches, useCreateBatch, useStartBatch, useCompleteBatch, useCancelBatch,
} from '@/hooks/useProductionBatches';
import { type CreateBatchInput, type ProductionBatch, type BatchStatus } from '@/lib/api/productionBatches';
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildBatchColumns } from './batch-columns';
import { BarChart3, Factory, Plus } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiErrorMessage } from '@/lib/api/error-message';

const ITEMS_PER_PAGE = 20;

const STATUSES: BatchStatus[] = ['planned', 'in_progress', 'completed', 'cancelled', 'failed'];

export default function ProductionBatchesPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [status, setStatus] = useState<BatchStatus | ''>('');
    const [range, setRange] = useState<DateRange>({ from: '', to: '' });
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);

    const { data, isLoading, isError, refetch } = useProductionBatches(orgSlug, { status: status || undefined, from: range.from || undefined, to: range.to || undefined, page, limit: ITEMS_PER_PAGE });
    const createBatch = useCreateBatch(orgSlug);
    const startBatch = useStartBatch(orgSlug);
    const completeBatch = useCompleteBatch(orgSlug);
    const cancelBatch = useCancelBatch(orgSlug);

    const { canAny } = usePermissions();
    const canAdd = canAny([P.CATALOG_ADD, P.CATALOG_MANAGE]);
    const canChange = canAny([P.CATALOG_CHANGE, P.CATALOG_MANAGE]);

    const rows = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE));
    useMemo(() => { setPage(1); }, [status, range]);

    function act(label: string, p: Promise<unknown>) {
        p.then(() => toast.success(label)).catch(async (e) => toast.error(await apiErrorMessage(e, `Failed to ${label.toLowerCase()}`)));
    }

    function handleSubmit(input: CreateBatchInput) {
        createBatch.mutate(input, {
            onSuccess: () => { toast.success('Batch created'); setDialogOpen(false); },
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to create batch')),
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

    const columns = useMemo(() => buildBatchColumns({ orgSlug, workflowActions }), [orgSlug, canChange]);

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
                <CardHeader className="flex flex-row flex-wrap items-center gap-2">
                    <select className="border border-border rounded-md px-3 py-2 text-sm bg-background"
                        value={status} onChange={(e) => setStatus(e.target.value as BatchStatus | '')}>
                        <option value="">All statuses</option>
                        {STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                    </select>
                    <DateRangePicker value={range} onChange={setRange} className="w-56" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<ProductionBatch>
                            columns={columns}
                            rows={rows}
                            rowKey={(r) => r.id}
                            loading={isLoading}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyState={
                                <>
                                    <Factory className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">No production batches yet</p>
                                </>
                            }
                            storageKey="production-batches-col-prefs"
                            page={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            total={data?.total}
                            pageSize={ITEMS_PER_PAGE}
                        />
                    </div>
                </CardContent>
            </Card>

            {dialogOpen && (
                <BatchFormDialog isPending={createBatch.isPending} onSubmit={handleSubmit} onClose={() => setDialogOpen(false)} />
            )}
        </div>
    );
}
