'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { useStockValuation } from '@/hooks/useReports';
import { ArrowLeft, Boxes, DollarSign, Layers, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

function fmt(n: number) {
    return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

// StockValuationPage shows total inventory value (on-hand × unit cost), broken down by category
// and the highest-value items. Read-only admin report.
export default function StockValuationPage() {
    const params = useParams();
    const org = params?.orgSlug as string;
    const { data, isLoading, refetch, isFetching } = useStockValuation(org);
    const cur = data?.currency ?? 'KES';

    const kpis = [
        { label: 'Total Stock Value', value: `${cur} ${fmt(data?.total_value ?? 0)}`, icon: DollarSign },
        { label: 'Total Units', value: fmt(data?.total_units ?? 0), icon: Boxes },
        { label: 'Items Valued', value: fmt(data?.item_count ?? 0), icon: Layers },
    ];

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
                <Button variant="outline" size="sm" disabled={isFetching} onClick={() => refetch()}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
                </Button>
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
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Category</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Items</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Units</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Value ({cur})</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(data?.by_category?.length ?? 0) === 0 && (
                                    <tr><td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">{isLoading ? 'Loading…' : 'No stock on hand.'}</td></tr>
                                )}
                                {data?.by_category?.map((c) => (
                                    <tr key={c.category_name} className="hover:bg-accent/30 transition-colors">
                                        <td className="px-6 py-3 font-medium">{c.category_name}</td>
                                        <td className="px-6 py-3 text-right tabular-nums">{c.item_count}</td>
                                        <td className="px-6 py-3 text-right tabular-nums hidden sm:table-cell">{fmt(c.total_units)}</td>
                                        <td className="px-6 py-3 text-right tabular-nums font-semibold">{fmt(c.total_value)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><h2 className="text-lg font-semibold">Top Items by Value</h2></CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Item</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Category</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">On hand</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Unit cost</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Value ({cur})</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {(data?.top_items?.length ?? 0) === 0 && (
                                    <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">{isLoading ? 'Loading…' : 'No valued items.'}</td></tr>
                                )}
                                {data?.top_items?.map((it) => (
                                    <tr key={it.item_id} className="hover:bg-accent/30 transition-colors">
                                        <td className="px-6 py-3 font-medium">
                                            {it.name}
                                            <span className="block text-xs text-muted-foreground font-mono">{it.sku}</span>
                                        </td>
                                        <td className="px-6 py-3 text-muted-foreground hidden md:table-cell">{it.category_name || '—'}</td>
                                        <td className="px-6 py-3 text-right tabular-nums hidden sm:table-cell">{fmt(it.on_hand)}</td>
                                        <td className="px-6 py-3 text-right tabular-nums hidden sm:table-cell">{it.unit_cost.toLocaleString()}</td>
                                        <td className="px-6 py-3 text-right tabular-nums font-semibold">{fmt(it.value)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
