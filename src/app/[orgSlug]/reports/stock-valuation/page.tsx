'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { ReportLocationPicker, useReportLocation } from '@/components/reports/report-location-scope';
import { ReportItemFilterBar, ReportPager, useReportItemFilters } from '@/components/reports/report-item-filters';
import { useStockValuation } from '@/hooks/useReports';
import { reportsApi } from '@/lib/api/reports';
import type { StockValuationBrand, StockValuationCategory, StockValuationItem } from '@/lib/api/reports';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import {
    buildStockValuationBrandColumns,
    buildStockValuationCategoryColumns,
    buildStockValuationTopItemColumns,
} from './stock-valuation-columns';
import { Boxes, DollarSign, ArrowLeft, Layers, Printer, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';

const PAGE_SIZE = 25;

function fmt(n: number) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// StockValuationPage shows total inventory value (on-hand x unit cost), broken down by category
// and brand, and the items by value. Read-only admin report.
//
// Scoped like Deadstock (2026-11-18): the top-nav outlet narrows it to that outlet's own
// locations and the picker drills into one; with no outlet it blends every location. Category,
// brand and search filters narrow the totals too, not just the list.
export default function StockValuationPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const { scope, scopeName, picker } = useReportLocation(org);
    const { filters, bar, setOffset } = useReportItemFilters(org, PAGE_SIZE);
    const { data, isLoading, isError, refetch, isFetching } = useStockValuation(org, scope, filters);
    const cur = data?.currency ?? 'KES';
    const [breakdown, setBreakdown] = useState<'category' | 'brand'>('category');

    // Print / Export streams the branded PDF for the same location and filters.
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function printReport() {
        openPreview(
            () => reportsApi.stockValuationDoc(org, 'pdf', scope, { ...filters, offset: undefined, limit: undefined }),
            { fileName: 'stock-valuation.pdf', title: 'Stock Valuation' },
        );
    }

    const kpis = [
        { label: 'Total Stock Value', value: `${cur} ${fmt(data?.total_value ?? 0)}`, icon: DollarSign },
        { label: 'Total Units', value: fmt(data?.total_units ?? 0), icon: Boxes },
        { label: 'Items Valued', value: fmt(data?.item_count ?? 0), icon: Layers },
    ];

    const categoryColumns = useMemo(() => buildStockValuationCategoryColumns(cur), [cur]);
    const brandColumns = useMemo(() => buildStockValuationBrandColumns(cur), [cur]);
    const topItemColumns = useMemo(() => buildStockValuationTopItemColumns(cur), [cur]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
                <Link href={`/${org}/stock`}>
                    <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Stock</Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">Stock Valuation</h1>
                    <p className="text-muted-foreground text-sm">
                        On-hand x unit cost, by category, brand and item
                        {scopeName && (
                            <> &middot; <span className="font-medium text-foreground">{scopeName}</span></>
                        )}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={printReport}>
                        <Printer className="h-4 w-4 mr-2" /> Print / Export
                    </Button>
                    <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
                        <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
                    </Button>
                </div>
            </div>

            <ReportLocationPicker {...picker} noun="stock value" />
            <ReportItemFilterBar {...bar} />

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
                <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-lg font-semibold">Value by {breakdown === 'category' ? 'Category' : 'Brand'}</h2>
                        <div className="flex items-center gap-1.5" role="tablist" aria-label="Breakdown">
                            {(['category', 'brand'] as const).map((b) => (
                                <button
                                    key={b}
                                    type="button"
                                    role="tab"
                                    aria-selected={breakdown === b}
                                    onClick={() => setBreakdown(b)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${breakdown === b ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-muted-foreground hover:text-foreground'}`}
                                >
                                    {b === 'category' ? 'Category' : 'Brand'}
                                </button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        {breakdown === 'category' ? (
                            <DataTable<StockValuationCategory>
                                columns={categoryColumns}
                                rows={data?.by_category ?? []}
                                rowKey={(c) => c.category_name}
                                loading={isLoading}
                                loadingRows={8}
                                error={isError}
                                onRetry={() => refetch()}
                                emptyText="No stock on hand."
                            />
                        ) : (
                            <DataTable<StockValuationBrand>
                                columns={brandColumns}
                                rows={data?.by_brand ?? []}
                                rowKey={(b) => b.brand_name}
                                loading={isLoading}
                                loadingRows={8}
                                error={isError}
                                onRetry={() => refetch()}
                                emptyText="No stock on hand."
                            />
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><h2 className="text-lg font-semibold">Items by Value</h2></CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<StockValuationItem>
                            columns={topItemColumns}
                            rows={data?.top_items ?? []}
                            rowKey={(it) => it.item_id}
                            loading={isLoading}
                            loadingRows={8}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyText="No valued items."
                        />
                    </div>
                    <ReportPager
                        offset={data?.offset ?? 0}
                        limit={data?.limit ?? PAGE_SIZE}
                        total={data?.item_count ?? 0}
                        shown={data?.top_items?.length ?? 0}
                        onOffset={setOffset}
                    />
                </CardContent>
            </Card>

            <PdfPreview {...previewProps} />
        </div>
    );
}
