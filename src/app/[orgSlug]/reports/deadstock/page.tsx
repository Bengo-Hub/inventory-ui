'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { useDeadstock } from '@/hooks/useReports';
import { reportsApi } from '@/lib/api/reports';
import type { DeadstockItem } from '@/lib/api/reports';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildDeadstockColumns } from './deadstock-columns';
import { AlertTriangle, ArrowLeft, Boxes, DollarSign, Printer, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';

function fmt(n: number) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const DAYS_OPTIONS = [30, 60, 90, 180];

// DeadstockPage lists stock on hand that has NOT sold within the window — capital tied up in
// non-moving inventory. Read-only admin report.
export default function DeadstockPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const [days, setDays] = useState(90);
    const { data, isLoading, isError, refetch, isFetching } = useDeadstock(org, days);
    const cur = data?.currency ?? 'KES';

    // Print / Export — streams the branded deadstock PDF for the active lookback window.
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function printReport() {
        openPreview(
            () => reportsApi.deadstockDoc(org, days, 'pdf'),
            { fileName: `deadstock-${days}d.pdf`, title: 'Deadstock' },
        );
    }

    const kpis = [
        { label: 'Capital Tied Up', value: `${cur} ${fmt(data?.total_dead_value ?? 0)}`, icon: DollarSign },
        { label: 'Non-Moving Items', value: fmt(data?.item_count ?? 0), icon: Boxes },
        { label: 'No Sale In', value: `${days} days`, icon: AlertTriangle },
    ];

    const columns = useMemo(() => buildDeadstockColumns(cur), [cur]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
                <Link href={`/${org}/stock`}>
                    <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Stock</Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">Deadstock</h1>
                    <p className="text-muted-foreground text-sm">Stock on hand that hasn&apos;t sold within the window</p>
                </div>
                <div className="flex items-center gap-1.5">
                    {DAYS_OPTIONS.map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => setDays(d)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${days === d ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
                        >
                            {d}d
                        </button>
                    ))}
                    <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
                        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="outline" size="sm" onClick={printReport}>
                        <Printer className="h-4 w-4 mr-2" /> Print / Export
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <CardHeader><h2 className="text-lg font-semibold">Non-Moving Items (top by value)</h2></CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<DeadstockItem>
                            columns={columns}
                            rows={data?.items ?? []}
                            rowKey={(it) => it.item_id}
                            loading={isLoading}
                            loadingRows={8}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyText="No deadstock — everything is moving."
                        />
                    </div>
                </CardContent>
            </Card>

            <PdfPreview {...previewProps} />
        </div>
    );
}
