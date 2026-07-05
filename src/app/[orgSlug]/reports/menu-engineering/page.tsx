'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input, Table } from '@/components/ui/base';
import { useMenuEngineering } from '@/hooks/useReports';
import { reportsApi, type MenuCategory, type MenuMatrixItem } from '@/lib/api/reports';
import { Printer, RefreshCw, Star, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { PdfPreview, useDocumentPreview } from '@bengo-hub/shared-ui-lib/documents';

type CategoryConfig = {
    label: string;
    description: string;
    variant: 'default' | 'success' | 'warning' | 'error' | 'outline';
    action: string;
};

const CATEGORY: Record<MenuCategory, CategoryConfig> = {
    STAR: {
        label: 'Star',
        description: 'High popularity, high profit',
        variant: 'success',
        action: 'Promote and protect — keep quality consistent',
    },
    PLOWHORSE: {
        label: 'Plowhorse',
        description: 'High popularity, low profit',
        variant: 'warning',
        action: 'Reprice or reduce portion cost to improve margin',
    },
    PUZZLE: {
        label: 'Puzzle',
        description: 'Low popularity, high profit',
        variant: 'default',
        action: 'Reposition, rename, or feature in specials',
    },
    DOG: {
        label: 'Dog',
        description: 'Low popularity, low profit',
        variant: 'error',
        action: 'Consider removing from menu or reinventing',
    },
};

function toISO(d: Date): string {
    return d.toISOString().split('T')[0];
}

function formatCurrency(v?: number): string {
    if (v == null) return '—';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(v);
}

function CategoryBadge({ category }: { category: MenuCategory }) {
    const cfg = CATEGORY[category];
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

export default function MenuEngineeringPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;

    const now = new Date();
    const [from, setFrom] = useState(toISO(new Date(now.getFullYear(), now.getMonth(), 1)));
    const [to, setTo] = useState(toISO(now));
    const [queryParams, setQueryParams] = useState({ from, to, tenant_slug: orgSlug });

    const { data, isLoading, isFetching } = useMenuEngineering(orgSlug, queryParams);
    const rows = data ?? [];

    const counts: Record<MenuCategory, number> = { STAR: 0, PLOWHORSE: 0, PUZZLE: 0, DOG: 0 };
    rows.forEach(r => counts[r.category]++);

    function handleRun() {
        setQueryParams({ from, to, tenant_slug: orgSlug });
    }

    // Print / Export — streams the branded menu-engineering PDF for the selected period.
    const { openPreview, previewProps } = useDocumentPreview({ onError: (m: string) => toast.error(m) });
    function printReport() {
        openPreview(
            () => reportsApi.menuEngineeringDoc(orgSlug, { from, to, tenant_slug: orgSlug, format: 'pdf' }),
            { fileName: `menu-engineering-${from}_${to}.pdf`, title: 'Menu Engineering' },
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold">Menu Engineering</h1>
                <p className="text-sm text-muted-foreground mt-1">Stars / Plowhorses / Puzzles / Dogs classification</p>
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
                        <Button variant="primary" onClick={handleRun} disabled={isFetching}>
                            <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                            {isFetching ? 'Loading…' : 'Analyze'}
                        </Button>
                        <Button variant="outline" onClick={printReport}>
                            <Printer className="h-4 w-4 mr-2" /> Print / Export
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Category summary */}
            {rows.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {(Object.entries(CATEGORY) as [MenuCategory, CategoryConfig][]).map(([cat, cfg]) => (
                        <Card key={cat}>
                            <CardContent className="p-4">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                                    <span className="text-2xl font-bold">{counts[cat]}</span>
                                </div>
                                <p className="text-xs text-muted-foreground">{cfg.description}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Legend */}
            {rows.length > 0 && (
                <Card>
                    <CardContent className="p-4">
                        <h3 className="text-sm font-semibold mb-3">Suggested Actions</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {(Object.entries(CATEGORY) as [MenuCategory, CategoryConfig][]).map(([cat, cfg]) => (
                                <div key={cat} className="flex items-start gap-2 text-sm">
                                    <Badge variant={cfg.variant} className="shrink-0 mt-0.5">{cfg.label}</Badge>
                                    <span className="text-muted-foreground">{cfg.action}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
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
                            <p className="text-sm">No data for this period. Click &quot;Analyze&quot; to load the matrix.</p>
                        </div>
                    ) : (
                        <Table>
                            <thead>
                                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                    <th className="px-6 py-3">Recipe</th>
                                    <th className="px-6 py-3 text-right">Units Sold</th>
                                    <th className="px-6 py-3 text-right">Contrib. Margin %</th>
                                    <th className="px-6 py-3 text-right">Suggested Price</th>
                                    <th className="px-6 py-3 text-center">Category</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {rows.map((row: MenuMatrixItem) => (
                                    <tr key={row.recipe_sku} className="hover:bg-muted/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium">{row.recipe_name}</div>
                                            <div className="text-xs text-muted-foreground">{row.recipe_sku}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm">
                                            {row.popularity.toFixed(0)}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm font-medium">
                                            {row.contrib_margin.toFixed(1)}%
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm">
                                            {formatCurrency(row.suggested_price)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <CategoryBadge category={row.category} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <PdfPreview {...previewProps} />
        </div>
    );
}
