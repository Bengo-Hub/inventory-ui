'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { ReportLocationPicker, useReportLocation } from '@/components/reports/report-location-scope';
import { ReportItemFilterBar, ReportPager, useReportItemFilters } from '@/components/reports/report-item-filters';
import { useDeadstock } from '@/hooks/useReports';
import { reportsApi } from '@/lib/api/reports';
import type { DeadstockItem } from '@/lib/api/reports';
import { formatDate } from '@/lib/user-timezone';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildDeadstockColumns } from './deadstock-columns';
import { AlertTriangle, ArrowLeft, Boxes, DollarSign, Info, Printer, RefreshCw, Sprout } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';

function fmt(n: number) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const DAYS_OPTIONS = [30, 60, 90, 180];
const PAGE_SIZE = 50;

// DeadstockPage lists stock on hand that has NOT moved within the window: capital tied up in
// non-moving inventory. Read-only admin report.
//
// Location-scoped like Stock Valuation: the top-nav outlet narrows it to that outlet's own
// locations (stock and movement both), and the picker drills into one location. An item selling
// at one location is still dead stock where it sits idle.
//
// Stock is only judged once it has been held for the whole window; younger idle stock shows as
// "too new" so a business that started recently does not see everything it just received as dead.
export default function DeadstockPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const [days, setDays] = useState(90);
    const { scope, scopeName, picker } = useReportLocation(org);
    const { filters, bar, setOffset } = useReportItemFilters(org, PAGE_SIZE);
    const { data, isLoading, isError, refetch, isFetching } = useDeadstock(org, days, scope, filters);
    const cur = data?.currency ?? 'KES';

    // Print / Export streams the branded deadstock PDF for the active window, location and filters.
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function printReport() {
        openPreview(
            () => reportsApi.deadstockDoc(org, days, 'pdf', scope, { ...filters, offset: undefined, limit: undefined }),
            { fileName: `deadstock-${days}d.pdf`, title: 'Deadstock' },
        );
    }

    // History shorter than the window: say so, so a short history is never read as "nothing sells".
    const historyDays = data?.history_since
        ? Math.floor((Date.now() - new Date(data.history_since).getTime()) / 86_400_000)
        : undefined;
    const shortHistory = historyDays != null && historyDays < days;

    const kpis = [
        { label: 'Capital Tied Up', value: `${cur} ${fmt(data?.total_dead_value ?? 0)}`, icon: DollarSign },
        { label: 'Non-Moving Items', value: fmt(data?.item_count ?? 0), icon: Boxes },
        {
            label: 'Too New To Judge',
            value: `${fmt(data?.too_new_count ?? 0)} items`,
            sub: `${cur} ${fmt(data?.too_new_value ?? 0)} received in the last ${days} days`,
            icon: Sprout,
        },
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
                    <p className="text-muted-foreground text-sm">
                        Stock on hand that hasn&apos;t moved within the window
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

            <ReportLocationPicker {...picker} noun="idle stock" />
            <ReportItemFilterBar {...bar} />

            {shortHistory && data?.history_since && (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
                    <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <p>
                        Stock records here start on <span className="font-medium">{formatDate(data.history_since)}</span>,
                        {' '}{historyDays} days ago. Items are only listed once they have been in stock for the full {days} days;
                        {' '}newer stock is counted under Too New To Judge. Try a shorter window to see slow sellers sooner.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {kpis.map((k) => (
                    <Card key={k.label}>
                        <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-muted-foreground">{k.label}</p>
                                <k.icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <p className="text-2xl font-bold mt-2 tabular-nums">{isLoading ? '…' : k.value}</p>
                            {'sub' in k && k.sub && <p className="text-xs text-muted-foreground mt-1">{isLoading ? '' : k.sub}</p>}
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
                            emptyText={(data?.too_new_count ?? 0) > 0
                                ? `Nothing has been idle for ${days} days yet. ${data?.too_new_count} newer items are still too new to judge.`
                                : 'No deadstock: everything is moving.'}
                        />
                    </div>
                    <ReportPager
                        offset={data?.offset ?? 0}
                        limit={data?.limit ?? PAGE_SIZE}
                        total={data?.item_count ?? 0}
                        shown={data?.items?.length ?? 0}
                        onOffset={setOffset}
                    />
                </CardContent>
            </Card>

            <PdfPreview {...previewProps} />
        </div>
    );
}
