'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input, Table } from '@/components/ui/base';
import { useFoodCostVariance } from '@/hooks/useReports';
import type { VarianceReportItem } from '@/lib/api/reports';
import { RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

function formatCurrency(v: number): string {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(v);
}

function varianceBadge(pct: number): { label: string; variant: 'success' | 'warning' | 'error' } {
    const abs = Math.abs(pct);
    if (abs < 3) return { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, variant: 'success' };
    if (abs < 8) return { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, variant: 'warning' };
    return { label: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`, variant: 'error' };
}

function toISO(d: Date): string {
    return d.toISOString().split('T')[0];
}

export default function FoodCostVariancePage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;

    const now = new Date();
    const defaultFrom = toISO(new Date(now.getFullYear(), now.getMonth(), 1));
    const defaultTo = toISO(now);

    const [from, setFrom] = useState(defaultFrom);
    const [to, setTo] = useState(defaultTo);
    const [recalculate, setRecalculate] = useState(false);

    const { data, isLoading, refetch, isFetching } = useFoodCostVariance(orgSlug, {
        from,
        to,
        recalculate,
        tenant_slug: orgSlug,
    });

    const rows = data ?? [];
    const totalTheoretical = rows.reduce((s, r) => s + r.theoretical_cost, 0);
    const totalActual = rows.reduce((s, r) => s + r.actual_cost, 0);
    const overallVariance = totalTheoretical > 0 ? ((totalActual - totalTheoretical) / totalTheoretical) * 100 : 0;

    function handleSearch() {
        refetch();
    }

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold">Food Cost Variance</h1>
                <p className="text-sm text-muted-foreground mt-1">Actual vs theoretical food cost by recipe</p>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">From</label>
                            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-40" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">To</label>
                            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-40" />
                        </div>
                        <div className="flex items-center gap-2 pb-1">
                            <input
                                type="checkbox"
                                id="recalc"
                                checked={recalculate}
                                onChange={e => setRecalculate(e.target.checked)}
                                className="rounded"
                            />
                            <label htmlFor="recalc" className="text-sm">Recalculate</label>
                        </div>
                        <Button variant="primary" onClick={handleSearch} disabled={isFetching}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                            {isFetching ? 'Loading…' : 'Run Report'}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Summary cards */}
            {rows.length > 0 && (
                <div className="grid grid-cols-3 gap-4">
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Theoretical Cost</p>
                            <p className="text-2xl font-bold">{formatCurrency(totalTheoretical)}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Actual Cost</p>
                            <p className="text-2xl font-bold">{formatCurrency(totalActual)}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4">
                            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Overall Variance</p>
                            <div className="flex items-center gap-2">
                                {overallVariance >= 0
                                    ? <TrendingUp className="h-5 w-5 text-red-500" />
                                    : <TrendingDown className="h-5 w-5 text-green-500" />}
                                <p className={`text-2xl font-bold ${Math.abs(overallVariance) >= 8 ? 'text-red-500' : Math.abs(overallVariance) >= 3 ? 'text-yellow-500' : 'text-green-500'}`}>
                                    {overallVariance >= 0 ? '+' : ''}{overallVariance.toFixed(1)}%
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Results table */}
            <Card>
                <CardHeader>
                    <span className="text-sm text-muted-foreground">{rows.length} recipe{rows.length !== 1 ? 's' : ''}</span>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-16 text-muted-foreground">Loading…</div>
                    ) : rows.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                            <p className="text-sm">No variance data for this period. Try &quot;Recalculate&quot; to generate fresh data.</p>
                        </div>
                    ) : (
                        <Table>
                            <thead>
                                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    <th className="px-6 py-3">Recipe</th>
                                    <th className="px-6 py-3 text-right">Theoretical</th>
                                    <th className="px-6 py-3 text-right">Actual</th>
                                    <th className="px-6 py-3 text-right">Variance</th>
                                    <th className="px-6 py-3 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rows.map((row: VarianceReportItem) => {
                                    const { label, variant } = varianceBadge(row.variance_pct);
                                    return (
                                        <tr key={row.recipe_sku} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="font-medium">{row.recipe_name}</div>
                                                <div className="text-xs text-muted-foreground">{row.recipe_sku}</div>
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm">{formatCurrency(row.theoretical_cost)}</td>
                                            <td className="px-6 py-4 text-right text-sm">{formatCurrency(row.actual_cost)}</td>
                                            <td className="px-6 py-4 text-right text-sm font-medium">
                                                {formatCurrency(row.actual_cost - row.theoretical_cost)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <Badge variant={variant}>{label}</Badge>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
