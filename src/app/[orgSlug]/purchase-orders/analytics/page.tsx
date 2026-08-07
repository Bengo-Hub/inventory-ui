'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { useProcurementDashboard, useSupplierPerformance, useRecomputeSupplierPerformance } from '@/hooks/useProcurement';
import { useSuppliers } from '@/hooks/useSuppliers';
import type { SupplierPerformance } from '@/lib/api/procurement';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildSupplierPerformanceColumns } from './supplier-performance-columns';
import { ArrowLeft, ClipboardList, DollarSign, RefreshCw, ShoppingCart, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';

const PO_STATUS_LABEL: Record<string, string> = {
    draft: 'Draft', sent: 'Sent', partially_received: 'Partial', received: 'Received', cancelled: 'Cancelled',
};
const PO_STATUS_COLOR: Record<string, string> = {
    draft: 'bg-muted-foreground/40', sent: 'bg-blue-500', partially_received: 'bg-amber-500', received: 'bg-emerald-500', cancelled: 'bg-red-500',
};

export default function ProcurementAnalyticsPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const { data: dash, isLoading } = useProcurementDashboard(org);
    const { data: perf } = useSupplierPerformance(org);
    const recompute = useRecomputeSupplierPerformance(org);
    const { data: suppliersPage } = useSuppliers(org);
    const suppliers = suppliersPage?.data ?? [];
    const nameOf = (id: string) => suppliers.find((s) => s.id === id)?.name ?? id.slice(0, 8);

    const columns = useMemo(() => buildSupplierPerformanceColumns({ nameOf }), [suppliers]);

    const byStatus = dash?.purchase_orders_by_status ?? {};
    const statusTotal = Object.values(byStatus).reduce((a, b) => a + b, 0) || 1;

    const kpis = [
        { label: 'Purchase Orders', value: dash?.total_purchase_orders ?? 0, icon: ShoppingCart },
        { label: 'Total Spend', value: (dash?.total_spend ?? 0).toLocaleString(), icon: DollarSign },
        { label: 'Open Requisitions', value: dash?.open_requisitions ?? 0, icon: ClipboardList },
        { label: 'Active Suppliers', value: dash?.active_suppliers ?? 0, icon: Users },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
                <Link href={`/${org}/purchase-orders`}><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Purchase Orders</Button></Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Procurement Analytics</h1>
                    <p className="text-muted-foreground text-sm">Spend, pipeline &amp; supplier performance</p>
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
                <CardHeader><h2 className="text-lg font-semibold">Purchase Orders by Status</h2></CardHeader>
                <CardContent className="space-y-3">
                    {Object.keys(PO_STATUS_LABEL).map((s) => {
                        const n = byStatus[s] ?? 0;
                        return (
                            <div key={s} className="flex items-center gap-3">
                                <span className="w-24 text-sm text-muted-foreground">{PO_STATUS_LABEL[s]}</span>
                                <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                                    <div className={`h-full ${PO_STATUS_COLOR[s]}`} style={{ width: `${(n / statusTotal) * 100}%` }} />
                                </div>
                                <span className="w-10 text-right text-sm tabular-nums">{n}</span>
                            </div>
                        );
                    })}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Supplier Performance</h2>
                        <Button variant="outline" size="sm" disabled={recompute.isPending}
                            onClick={() => recompute.mutate(undefined, { onSuccess: (res) => toast.success(`Recomputed ${res?.computed ?? 0} suppliers`), onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to recompute')) })}>
                            <RefreshCw className="h-4 w-4 mr-2" /> Recompute
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<SupplierPerformance>
                            columns={columns}
                            rows={perf?.data ?? []}
                            rowKey={(p) => p.id}
                            emptyText="No supplier performance records yet."
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
