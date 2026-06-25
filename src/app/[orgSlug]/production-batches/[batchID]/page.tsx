'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import {
    useProductionBatch, useBatchMaterials, useBatchQC, useStartBatch, useCompleteBatch,
    useCancelBatch, useAddQC, useMaterialCheck,
} from '@/hooks/useProductionBatches';
import { useRecipe } from '@/hooks/use-recipes';
import { type BatchStatus } from '@/lib/api/productionBatches';
import { AlertTriangle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { usePermissions, P } from '@/hooks/usePermissions';
import { apiErrorMessage } from '@/lib/api/error-message';

const STATUS_VARIANT: Record<BatchStatus, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    planned: 'outline', in_progress: 'warning', completed: 'success', cancelled: 'error', failed: 'error',
};
const selectClass = 'rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';
const money = (n?: number | null) => (n != null ? n.toLocaleString() : '—');

export default function BatchDetailPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const batchId = params?.batchID as string;

    const { data: batch, isLoading } = useProductionBatch(org, batchId);
    const { data: materials } = useBatchMaterials(org, batchId);
    const { data: qcs } = useBatchQC(org, batchId);
    const { data: recipe } = useRecipe(org, batch?.recipe_id ?? '');
    const start = useStartBatch(org);
    const complete = useCompleteBatch(org);
    const cancel = useCancelBatch(org);
    const addQC = useAddQC(org, batchId);
    const { data: check } = useMaterialCheck(org, batch?.recipe_id ?? '', batch?.status === 'planned' ? (batch?.planned_quantity ?? 0) : 0);

    const { canAny } = usePermissions();
    const canChange = canAny([P.CATALOG_CHANGE, P.CATALOG_MANAGE]);

    const [actualQty, setActualQty] = useState('');
    const [scrapQty, setScrapQty] = useState('');
    const [qcResult, setQcResult] = useState('pass');
    const [qcNotes, setQcNotes] = useState('');

    if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
    if (!batch) return <div className="p-6">Batch not found. <Link href={`/${org}/production-batches`} className="text-primary">Back</Link></div>;

    function doStart(force: boolean) {
        start.mutate({ id: batchId, force }, {
            onSuccess: () => toast.success('Batch started — materials consumed'),
            onError: async (e) => toast.error(await apiErrorMessage(e, force ? 'Failed to start' : 'Insufficient materials — use Force Start to override')),
        });
    }
    function doComplete() {
        const qty = Number(actualQty);
        if (!Number.isFinite(qty) || qty <= 0) { toast.error('Enter a valid actual quantity'); return; }
        complete.mutate({ id: batchId, actualQuantity: qty, scrapQuantity: Number(scrapQty) || 0 }, {
            onSuccess: () => toast.success('Batch completed — finished goods received'),
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to complete (a passing QC may be required)')),
        });
    }

    const hasShortage = batch.status === 'planned' && check && !check.ok;

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
                <Link href={`/${org}/production-batches`}><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Batches</Button></Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{batch.batch_number}</h1>
                    <p className="text-muted-foreground text-sm">{recipe?.name ?? 'Recipe'}</p>
                </div>
                <Badge variant={STATUS_VARIANT[batch.status]} className="ml-2">{batch.status.replace(/_/g, ' ')}</Badge>
                {canChange && (
                    <div className="ml-auto flex gap-2">
                        {batch.status === 'planned' && <Button size="sm" disabled={start.isPending} onClick={() => doStart(false)}>Start</Button>}
                        {hasShortage && <Button size="sm" variant="outline" disabled={start.isPending} onClick={() => doStart(true)}>Force Start</Button>}
                        {(batch.status === 'planned' || batch.status === 'in_progress') && (
                            <Button size="sm" variant="outline" onClick={() => { const reason = window.prompt('Reason for cancellation:'); if (reason) cancel.mutate({ id: batchId, reason }, { onSuccess: () => toast.success('Batch cancelled'), onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed')) }); }}>Cancel</Button>
                        )}
                    </div>
                )}
            </div>

            {hasShortage && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
                    <div className="flex items-center gap-2 text-amber-600 font-medium"><AlertTriangle className="h-4 w-4" /> Insufficient raw materials to start</div>
                    <ul className="mt-1 ml-6 list-disc text-muted-foreground">
                        {check?.shortages.map((s) => <li key={s.item_id}>{s.item_sku || s.item_id.slice(0, 8)}: need {s.required}, have {s.available}</li>)}
                    </ul>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-1">
                    <CardHeader><h2 className="text-lg font-semibold">Overview</h2></CardHeader>
                    <CardContent>
                        <dl className="space-y-3 text-sm">
                            {([
                                ['Planned qty', batch.planned_quantity],
                                ['Actual qty', batch.actual_quantity ?? '—'],
                                ['Scrap qty', batch.scrap_quantity ?? 0],
                                ['Labor cost', money(batch.labor_cost)],
                                ['Overhead cost', money(batch.overhead_cost)],
                                ['Unit cost', money(batch.unit_cost)],
                                ['Scheduled', batch.scheduled_date ? new Date(batch.scheduled_date).toLocaleDateString() : '—'],
                                ['Started', batch.start_date ? new Date(batch.start_date).toLocaleDateString() : '—'],
                                ['Completed', batch.end_date ? new Date(batch.end_date).toLocaleDateString() : '—'],
                            ] as [string, React.ReactNode][]).map(([k, v]) => (
                                <div key={k} className="flex justify-between gap-4"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium text-right">{v}</dd></div>
                            ))}
                        </dl>

                        {batch.status === 'in_progress' && canChange && (
                            <div className="mt-5 border-t border-border pt-4 space-y-2">
                                <p className="text-sm font-medium">Complete batch</p>
                                <Input type="number" min="0" placeholder="Actual quantity produced" value={actualQty} onChange={(e) => setActualQty(e.target.value)} />
                                <Input type="number" min="0" placeholder="Scrap quantity (optional)" value={scrapQty} onChange={(e) => setScrapQty(e.target.value)} />
                                <Button className="w-full" disabled={complete.isPending} onClick={doComplete}>{complete.isPending ? 'Completing…' : 'Complete & Receive Goods'}</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader><h2 className="text-lg font-semibold">Raw Materials Consumed</h2></CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-6 py-2 font-medium text-muted-foreground">Item</th>
                                        <th className="text-right px-6 py-2 font-medium text-muted-foreground">Quantity</th>
                                        <th className="text-right px-6 py-2 font-medium text-muted-foreground">Cost</th>
                                    </tr></thead>
                                    <tbody>
                                        {(materials?.length ?? 0) === 0 && <tr><td colSpan={3} className="px-6 py-6 text-center text-muted-foreground">No materials recorded (batch not started).</td></tr>}
                                        {materials?.map((m) => (
                                            <tr key={m.id} className="border-b border-border">
                                                <td className="px-6 py-2 font-mono text-xs">{m.item_id.slice(0, 8)}</td>
                                                <td className="px-6 py-2 text-right tabular-nums">{m.quantity}</td>
                                                <td className="px-6 py-2 text-right tabular-nums">{money(m.cost)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader><h2 className="text-lg font-semibold">Quality Checks</h2></CardHeader>
                        <CardContent className="space-y-4">
                            {canChange && batch.status !== 'cancelled' && (
                                <div className="flex flex-wrap items-end gap-2">
                                    <select className={selectClass} value={qcResult} onChange={(e) => setQcResult(e.target.value)}>
                                        <option value="pass">Pass</option>
                                        <option value="fail">Fail</option>
                                        <option value="pending">Pending</option>
                                    </select>
                                    <Input className="flex-1 min-w-40" placeholder="Notes (optional)" value={qcNotes} onChange={(e) => setQcNotes(e.target.value)} />
                                    <Button size="sm" disabled={addQC.isPending} onClick={() => addQC.mutate({ result: qcResult, notes: qcNotes.trim() || undefined }, { onSuccess: () => { toast.success('QC recorded'); setQcNotes(''); }, onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to record QC')) })}>Add QC</Button>
                                </div>
                            )}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead><tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-6 py-2 font-medium text-muted-foreground">Date</th>
                                        <th className="text-left px-6 py-2 font-medium text-muted-foreground">Result</th>
                                        <th className="text-left px-6 py-2 font-medium text-muted-foreground">Notes</th>
                                    </tr></thead>
                                    <tbody>
                                        {(qcs?.length ?? 0) === 0 && <tr><td colSpan={3} className="px-6 py-6 text-center text-muted-foreground">No quality checks yet.</td></tr>}
                                        {qcs?.map((q) => (
                                            <tr key={q.id} className="border-b border-border">
                                                <td className="px-6 py-2">{q.check_date ? new Date(q.check_date).toLocaleDateString() : '—'}</td>
                                                <td className="px-6 py-2"><Badge variant={q.result === 'pass' ? 'success' : q.result === 'fail' ? 'error' : 'warning'}>{q.result}</Badge></td>
                                                <td className="px-6 py-2 text-muted-foreground">{q.notes || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
