'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { ReportLocationPicker, useReportLocation } from '@/components/reports/report-location-scope';
import { useFastMoving } from '@/hooks/useReports';
import { reportsApi } from '@/lib/api/reports';
import type { FastMovingItem } from '@/lib/api/reports';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildFastMovingColumns } from './fast-moving-columns';
import { ArrowLeft, Clock, PackageX, Printer, RefreshCw, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';

const DAYS_OPTIONS = [7, 30, 60, 90];

function fmt(n: number) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// FastMovingPage ranks items by units moved (sold, used in production or in meals) within the
// window: the mirror image of Deadstock, using the same movement definition. Scoped to the
// selected outlet's locations, or one location, like Deadstock.
export default function FastMovingPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const [days, setDays] = useState(30);
    const { scope, scopeName, picker } = useReportLocation(org);
    const { data, isLoading, isError, refetch, isFetching } = useFastMoving(org, days, scope);
    const items = data?.items ?? [];

    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function printReport() {
        openPreview(
            () => reportsApi.fastMovingDoc(org, days, 'pdf', scope),
            { fileName: `fast-moving-${days}d.pdf`, title: 'Fast Moving' },
        );
    }

    // Busy items already at or below zero at this location: the ones to restock first.
    const outOfStock = items.filter((it) => it.on_hand <= 0).length;
    const kpis = [
        { label: 'Items Moving', value: fmt(data?.item_count ?? 0), icon: TrendingUp },
        { label: 'Busy Items Out of Stock', value: fmt(outOfStock), icon: PackageX, hint: 'Among the top 100 listed' },
        { label: 'Window', value: `${days} days`, icon: Clock },
    ];

    const columns = useMemo(() => buildFastMovingColumns(days), [days]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
                <Link href={`/${org}/stock`}>
                    <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Stock</Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">Fast Moving</h1>
                    <p className="text-muted-foreground text-sm">
                        Items moving the most units within the window
                        {scopeName && (
                            <> &middot; <span className="font-medium text-foreground">{scopeName}</span></>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-1.5">
                    {DAYS_OPTIONS.map((d) => (
                        <button
                            key={d}
                            type="button"
                            onClick={() => setDays(d)}
                            aria-pressed={days === d}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${days === d ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
                        >
                            {d}d
                        </button>
                    ))}
                    <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()} aria-label="Refresh">
                        <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button variant="outline" size="sm" onClick={printReport}>
                        <Printer className="h-4 w-4 mr-2" /> Print / Export
                    </Button>
                </div>
            </div>

            <ReportLocationPicker {...picker} noun="stock movement" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {kpis.map((k) => (
                    <Card key={k.label}>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">{k.label}</p>
                                <k.icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-2xl font-bold mt-2 tabular-nums">{isLoading ? '…' : k.value}</p>
                            {k.hint && <p className="text-xs text-muted-foreground mt-1">{k.hint}</p>}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader><h2 className="text-lg font-semibold">Busiest Items (top 100 by units moved)</h2></CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<FastMovingItem>
                            columns={columns}
                            rows={items}
                            rowKey={(it) => it.item_id}
                            loading={isLoading}
                            loadingRows={8}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyText="Nothing moved in this window."
                        />
                    </div>
                </CardContent>
            </Card>

            <PdfPreview {...previewProps} />
        </div>
    );
}
