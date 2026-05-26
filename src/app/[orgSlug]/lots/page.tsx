'use client';

import { Badge, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { useLots } from '@/hooks/useLots';
import { AlertTriangle, Layers, Search } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

const ITEMS_PER_PAGE = 20;
const EXPIRY_WARNING_DAYS = 30;

function isExpiringSoon(expiryDate?: string): boolean {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + EXPIRY_WARNING_DAYS);
    return expiry <= threshold && expiry > new Date();
}

function isExpired(expiryDate?: string): boolean {
    if (!expiryDate) return false;
    return new Date(expiryDate) <= new Date();
}

export default function LotsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const { data: lots, isLoading } = useLots(orgSlug);

    const filtered = search
        ? lots?.filter((l) =>
            (l.lot_number ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (l.item_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
            (l.item_sku ?? '').toLowerCase().includes(search.toLowerCase())
          )
        : lots;

    const totalPages = Math.max(1, Math.ceil((filtered?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = filtered?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    const expiringSoonCount = lots?.filter((l) => isExpiringSoon(l.expiry_date)).length ?? 0;

    useMemo(() => { setPage(1); }, [search]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Lots & Batches</h1>
                    <p className="text-muted-foreground mt-1">Track lot numbers, batches, and expiry dates</p>
                </div>
            </div>

            {expiringSoonCount > 0 && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">
                        {expiringSoonCount} lot{expiringSoonCount > 1 ? 's' : ''} expiring within {EXPIRY_WARNING_DAYS} days
                    </p>
                </div>
            )}

            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by lot number, item, or SKU..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Lot Number</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Item</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Warehouse</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Expiry Date</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Quantity</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading lots...
                                        </td>
                                    </tr>
                                ) : (filtered?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <Layers className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No lots found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((lot) => {
                                        const expiring = isExpiringSoon(lot.expiry_date);
                                        const expired = isExpired(lot.expiry_date);
                                        const statusVariant: 'success' | 'warning' | 'error' | 'default' = expired ? 'error' : expiring ? 'warning' : 'success';
                                        const statusLabel = expired ? 'Expired' : expiring ? 'Expiring Soon' : 'Active';
                                        return (
                                            <tr
                                                key={lot.id}
                                                className={`hover:bg-accent/30 transition-colors ${
                                                    expiring ? 'bg-yellow-500/5' : expired ? 'bg-red-500/5' : ''
                                                }`}
                                            >
                                                <td className="px-6 py-4 font-mono text-xs font-medium">{lot.lot_number}</td>
                                                <td className="px-6 py-4">
                                                    <div>{lot.item_name ?? '—'}</div>
                                                    {lot.item_sku && <div className="text-xs text-muted-foreground font-mono">{lot.item_sku}</div>}
                                                </td>
                                                <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">{lot.warehouse_name ?? '—'}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {lot.expiry_date ? (
                                                            <>
                                                                <span className={expired ? 'text-red-500 font-medium' : expiring ? 'text-yellow-500 font-medium' : ''}>
                                                                    {new Date(lot.expiry_date).toLocaleDateString()}
                                                                </span>
                                                                {(expiring || expired) && (
                                                                    <AlertTriangle className={`h-3.5 w-3.5 ${expired ? 'text-red-500' : 'text-yellow-500'}`} />
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="text-muted-foreground">N/A</span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-right font-semibold tabular-nums hidden sm:table-cell">
                                                    {lot.quantity.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={statusVariant}>{statusLabel}</Badge>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (filtered?.length ?? 0) > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
