'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { useStockValuation } from '@/hooks/useReports';
import { reportsApi } from '@/lib/api/reports';
import type { StockValuationCategory, StockValuationItem } from '@/lib/api/reports';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildStockValuationCategoryColumns, buildStockValuationTopItemColumns } from './stock-valuation-columns';
import { Boxes, DollarSign, ArrowLeft, Layers, Printer, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';

function fmt(n: number) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// StockValuationPage shows total inventory value (on-hand × unit cost), broken down by category
// and the highest-value items. Read-only admin report.
export default function StockValuationPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const { data, isLoading, isError, refetch, isFetching } = useStockValuation(org);
    const cur = data?.currency ?? 'KES';

    // Print / Export — streams the branded PDF from inventory-api into the shared previewer.
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function printReport() {
        openPreview(
            () => reportsApi.stockValuationDoc(org, 'pdf'),
            { fileName: 'stock-valuation.pdf', title: 'Stock Valuation' },
        );
    }

    const kpis = [
        { label: 'Total Stock Value', value: `${cur} ${fmt(data?.total_value ?? 0)}`, icon: DollarSign },
        { label: 'Total Units', value: fmt(data?.total_units ?? 0), icon: Boxes },
        { label: 'Items Valued', value: fmt(data?.item_count ?? 0), icon: Layers },
    ];

    const categoryColumns = useMemo(() => buildStockValuationCategoryColumns(cur), [cur]);
    const topItemColumns = useMemo(() => buildStockValuationTopItemColumns(cur), [cur]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
                <Link href={`/${org}/stock`}>
                    <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Stock</Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">Stock Valuation</h1>
                    <p className="text-muted-foreground text-sm">On-hand × unit cost, by category and top items</p>
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
                <CardHeader><h2 className="text-lg font-semibold">Value by Category</h2></CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<StockValuationCategory>
                            columns={categoryColumns}
                            rows={data?.by_category ?? []}
                            rowKey={(c) => c.category_name}
                            loading={isLoading}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyText="No stock on hand."
                        />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><h2 className="text-lg font-semibold">Top Items by Value</h2></CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<StockValuationItem>
                            columns={topItemColumns}
                            rows={data?.top_items ?? []}
                            rowKey={(it) => it.item_id}
                            loading={isLoading}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyText="No valued items."
                        />
                    </div>
                </CardContent>
            </Card>

            <PdfPreview {...previewProps} />
        </div>
    );
}
