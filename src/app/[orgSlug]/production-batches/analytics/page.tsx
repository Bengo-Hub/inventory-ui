'use client';

import { Badge, Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { useManufacturingDashboard } from '@/hooks/useProductionBatches';
import { ArrowLeft, Factory, Boxes, CheckCircle2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const STATUS_LABEL: Record<string, string> = {
    planned: 'Planned', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled', failed: 'Failed',
};
const STATUS_COLOR: Record<string, string> = {
    planned: 'bg-muted-foreground/40', in_progress: 'bg-amber-500', completed: 'bg-emerald-500', cancelled: 'bg-red-500', failed: 'bg-red-600',
};
const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    planned: 'outline', in_progress: 'warning', completed: 'success', cancelled: 'error', failed: 'error',
};

export default function ManufacturingAnalyticsPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const { data: dash, isLoading } = useManufacturingDashboard(org);

    const byStatus = dash?.batches_by_status ?? {};
    const statusTotal = Object.values(byStatus).reduce((a, b) => a + b, 0) || 1;
    const kpis = [
        { label: 'Total Batches', value: dash?.total_batches ?? 0, icon: Factory },
        { label: 'Produced Qty', value: (dash?.total_produced_quantity ?? 0).toLocaleString(), icon: Boxes },
        { label: 'Completion Rate', value: `${Math.round((dash?.completion_rate ?? 0) * 100)}%`, icon: CheckCircle2 },
        { label: 'Scrap (units)', value: (dash?.scrap_total ?? 0).toLocaleString(), icon: Trash2 },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
                <Link href={`/${org}/production-batches`}><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Production Batches</Button></Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Manufacturing Analytics</h1>
                    <p className="text-muted-foreground text-sm">Production throughput, completion &amp; scrap</p>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((k) => (
                    <Card key={k.label}>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">{k.label}</p>
                                <k.icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-2xl font-bold mt-2 tabular-nums">{isLoading ? '…' : k.value}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader><h2 className="text-lg font-semibold">Batches by Status</h2></CardHeader>
                <CardContent className="space-y-3">
                    {Object.keys(STATUS_LABEL).map((s) => {
                        const n = byStatus[s] ?? 0;
                        return (
                            <div key={s} className="flex items-center gap-3">
                                <span className="w-28 text-sm text-muted-foreground">{STATUS_LABEL[s]}</span>
                                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                                    <div className={`h-full ${STATUS_COLOR[s]}`} style={{ width: `${(n / statusTotal) * 100}%` }} />
                                </div>
                                <span className="w-10 text-right text-sm tabular-nums">{n}</span>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <Card>
                <CardHeader><h2 className="text-lg font-semibold">Recent Batches</h2></CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-2 font-medium text-muted-foreground">Batch #</th>
                                    <th className="text-right px-6 py-2 font-medium text-muted-foreground">Planned</th>
                                    <th className="text-right px-6 py-2 font-medium text-muted-foreground">Actual</th>
                                    <th className="text-left px-6 py-2 font-medium text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(dash?.recent_batches?.length ?? 0) === 0 && <tr><td colSpan={4} className="px-6 py-6 text-center text-muted-foreground">No batches yet.</td></tr>}
                                {dash?.recent_batches?.map((b) => (
                                    <tr key={b.id} className="border-b border-border">
                                        <td className="px-6 py-2 font-mono text-xs">{b.batch_number}</td>
                                        <td className="px-6 py-2 text-right tabular-nums">{b.planned_quantity}</td>
                                        <td className="px-6 py-2 text-right tabular-nums">{b.actual_quantity ?? '—'}</td>
                                        <td className="px-6 py-2"><Badge variant={STATUS_VARIANT[b.status] ?? 'outline'}>{STATUS_LABEL[b.status] ?? b.status}</Badge></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
