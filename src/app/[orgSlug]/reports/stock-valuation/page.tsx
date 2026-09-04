'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { useStockValuation } from '@/hooks/useReports';
import { useWarehouses } from '@/hooks/useWarehouses';
import { reportsApi } from '@/lib/api/reports';
import type { StockValuationCategory, StockValuationItem } from '@/lib/api/reports';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildStockValuationCategoryColumns, buildStockValuationTopItemColumns } from './stock-valuation-columns';
import { Boxes, DollarSign, ArrowLeft, Layers, Printer, RefreshCw, MapPin } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';

const ALL_LOCATIONS_ID = '__all__';

function fmt(n: number) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// StockValuationPage shows total inventory value (on-hand × unit cost), broken down by category
// and the highest-value items. Read-only admin report.
//
// Location-scoped (2026-09-04): used to always blend every warehouse into one tenant-wide
// number, so a multi-outlet tenant comparing locations always saw the SAME figure regardless of
// which outlet they cared about — reported live as "everything shows as [the dominant location]
// instead of its own numbers." Defaults to "All Locations" (the prior behaviour, still useful for
// an HQ overview) with an explicit picker to drill into exactly one warehouse's own valuation.
export default function StockValuationPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const { data: warehouses } = useWarehouses(org);
    const [warehouseId, setWarehouseId] = useState('');
    const locationOptions = useMemo(
        () => [{ id: ALL_LOCATIONS_ID, name: 'All Locations' }, ...(warehouses ?? []).map((w) => ({ id: w.id, name: w.name }))],
        [warehouses],
    );
    const scopedWarehouseId = warehouseId && warehouseId !== ALL_LOCATIONS_ID ? warehouseId : undefined;
    const { data, isLoading, isError, refetch, isFetching } = useStockValuation(org, scopedWarehouseId);
    const cur = data?.currency ?? 'KES';

    // Print / Export — streams the branded PDF from inventory-api into the shared previewer.
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function printReport() {
        openPreview(
            () => reportsApi.stockValuationDoc(org, 'pdf', scopedWarehouseId),
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
                    <p className="text-muted-foreground text-sm">
                        On-hand × unit cost, by category and top items
                        {scopedWarehouseId && (
                            <> &middot; <span className="font-medium text-foreground">{locationOptions.find((o) => o.id === scopedWarehouseId)?.name}</span></>
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

            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="w-full sm:w-64">
                            <CreatableSelect
                                value={warehouseId || ALL_LOCATIONS_ID}
                                onChange={(v) => setWarehouseId(v === ALL_LOCATIONS_ID ? '' : v)}
                                options={locationOptions}
                                placeholder="All Locations"
                                required
                            />
                        </div>
                        <p className="text-xs text-muted-foreground hidden sm:block">
                            {scopedWarehouseId
                                ? "Showing this location's own valuation only."
                                : 'Showing every location blended together — pick one to see its own numbers.'}
                        </p>
                    </div>
                </CardContent>
            </Card>

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
                            loadingRows={8}
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
                            loadingRows={8}
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
