'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { CreatableSelect } from '@/components/inventory/CreatableSelect';
import { useDeadstock } from '@/hooks/useReports';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useOutletFilterStore } from '@/store/outlet-filter';
import { reportsApi } from '@/lib/api/reports';
import type { DeadstockItem } from '@/lib/api/reports';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildDeadstockColumns } from './deadstock-columns';
import { AlertTriangle, ArrowLeft, Boxes, DollarSign, MapPin, Printer, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';

function fmt(n: number) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

const DAYS_OPTIONS = [30, 60, 90, 180];
const ALL_LOCATIONS_ID = '__all__';

// DeadstockPage lists stock on hand that has NOT moved within the window: capital tied up in
// non-moving inventory. Read-only admin report.
//
// Location-scoped like Stock Valuation: the top-nav outlet narrows it to that outlet's own
// locations (stock and movement both), and the picker drills into one location. An item selling
// at one location is still dead stock where it sits idle.
export default function DeadstockPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const [days, setDays] = useState(90);
    const selectedOutlet = useOutletFilterStore((s) => s.selectedOutlet);
    const outletId = selectedOutlet?.id;
    const { data: warehouses } = useWarehouses(org);
    const [warehouseId, setWarehouseId] = useState('');
    const scopedWarehouses = useMemo(
        () => (warehouses ?? []).filter((w) => !outletId || w.outlet_id === outletId),
        [warehouses, outletId],
    );
    // A location picked under another outlet no longer applies once the outlet changes.
    useEffect(() => { setWarehouseId(''); }, [outletId]);
    const allLabel = selectedOutlet ? `All ${selectedOutlet.name} locations` : 'All Locations';
    const locationOptions = useMemo(
        () => [{ id: ALL_LOCATIONS_ID, name: allLabel }, ...scopedWarehouses.map((w) => ({ id: w.id, name: w.name }))],
        [scopedWarehouses, allLabel],
    );
    const scopedWarehouseId = warehouseId && warehouseId !== ALL_LOCATIONS_ID ? warehouseId : undefined;
    const scope = { outletId, warehouseId: scopedWarehouseId };
    const scopeName = scopedWarehouseId
        ? locationOptions.find((o) => o.id === scopedWarehouseId)?.name
        : selectedOutlet?.name;
    const { data, isLoading, isError, refetch, isFetching } = useDeadstock(org, days, scope);
    const cur = data?.currency ?? 'KES';

    // Print / Export streams the branded deadstock PDF for the active window and location.
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function printReport() {
        openPreview(
            () => reportsApi.deadstockDoc(org, days, 'pdf', scope),
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

            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <div className="w-full sm:w-64">
                            <CreatableSelect
                                value={warehouseId || ALL_LOCATIONS_ID}
                                onChange={(v) => setWarehouseId(v === ALL_LOCATIONS_ID ? '' : v)}
                                options={locationOptions}
                                placeholder={allLabel}
                                required
                            />
                        </div>
                        <p className="text-xs text-muted-foreground hidden sm:block">
                            {scopedWarehouseId
                                ? 'Showing stock idle at this location only.'
                                : selectedOutlet
                                    ? `Showing every location of ${selectedOutlet.name}. Pick one to see its own stock.`
                                    : 'Showing every location together. Pick one to see its own stock.'}
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
