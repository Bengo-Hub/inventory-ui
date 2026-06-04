'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { useAssetDashboard } from '@/hooks/useAssets';
import { ArrowLeft, Boxes, DollarSign, TrendingDown, Wallet } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const STATUS_LABEL: Record<string, string> = {
    active: 'Active', inactive: 'Inactive', maintenance: 'Maintenance', disposed: 'Disposed', lost: 'Lost', damaged: 'Damaged', retired: 'Retired',
};
const STATUS_COLOR: Record<string, string> = {
    active: 'bg-emerald-500', inactive: 'bg-muted-foreground/40', maintenance: 'bg-amber-500', disposed: 'bg-red-500', lost: 'bg-red-600', damaged: 'bg-red-400', retired: 'bg-muted-foreground/30',
};

export default function AssetsAnalyticsPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const { data: dash, isLoading } = useAssetDashboard(org);

    const byStatus = dash?.assets_by_status ?? {};
    const statusTotal = Object.values(byStatus).reduce((a, b) => a + b, 0) || 1;
    const money = (n?: number) => (n ?? 0).toLocaleString();
    const kpis = [
        { label: 'Total Assets', value: dash?.total_assets ?? 0, icon: Boxes },
        { label: 'Purchase Cost', value: money(dash?.total_purchase_cost), icon: DollarSign },
        { label: 'Current Book Value', value: money(dash?.total_current_value), icon: Wallet },
        { label: 'Accum. Depreciation', value: money(dash?.total_accumulated_depreciation), icon: TrendingDown },
    ];

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
                <Link href={`/${org}/assets`}><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Fixed Assets</Button></Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Asset Analytics</h1>
                    <p className="text-muted-foreground text-sm">Register value, depreciation &amp; status mix</p>
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
                <CardHeader><h2 className="text-lg font-semibold">Assets by Status</h2></CardHeader>
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
        </div>
    );
}
