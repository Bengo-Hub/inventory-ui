'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { useManufacturingDashboard } from '@/hooks/useProductionBatches';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildRecentBatchColumns, STATUS_LABEL, type RecentBatch } from './recent-batch-columns';
import { ArrowLeft, Factory, Boxes, CheckCircle2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';

const STATUS_COLOR: Record<string, string> = {
    planned: 'bg-muted-foreground/40', in_progress: 'bg-amber-500', completed: 'bg-emerald-500', cancelled: 'bg-red-500', failed: 'bg-red-600',
};

export default function ManufacturingAnalyticsPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const { data: dash, isLoading } = useManufacturingDashboard(org);
    const columns = useMemo(() => buildRecentBatchColumns(), []);

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
                    <div className="px-2 pb-2">
                        <DataTable<RecentBatch>
                            columns={columns}
                            rows={dash?.recent_batches ?? []}
                            rowKey={(b) => b.id}
                            emptyText="No batches yet."
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
