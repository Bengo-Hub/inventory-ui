'use client';

import { Badge, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { apiClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Layers, Search } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

const ITEMS_PER_PAGE = 20;
const EXPIRY_WARNING_DAYS = 30;

interface Lot {
    id: string;
    lotNumber: string;
    itemName: string;
    itemId: string;
    batchNumber: string;
    expiryDate: string | null;
    quantity: number;
    status: 'available' | 'reserved' | 'expired' | 'quarantine';
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'outline' | 'default'> = {
    available: 'success',
    reserved: 'default',
    expired: 'error',
    quarantine: 'warning',
};

function isExpiringSoon(expiryDate: string | null): boolean {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + EXPIRY_WARNING_DAYS);
    return expiry <= threshold && expiry > new Date();
}

function isExpired(expiryDate: string | null): boolean {
    if (!expiryDate) return false;
    return new Date(expiryDate) <= new Date();
}

export default function LotsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const { data: lots, isLoading } = useQuery<Lot[]>({
        queryKey: ['lots', orgSlug, search],
        queryFn: () => {
            const p: Record<string, string> = {};
            if (search) p.search = search;
            return apiClient.get(`/api/v1/${orgSlug}/inventory/lots`, p);
        },
        placeholderData: [],
    });

    const totalPages = Math.max(1, Math.ceil((lots?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = lots?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    const expiringSoonCount = lots?.filter((l) => isExpiringSoon(l.expiryDate)).length ?? 0;

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
                            placeholder="Search by lot number, item, or batch..."
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
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Batch</th>
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
                                ) : (lots?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <Layers className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No lots found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((lot) => {
                                        const expiring = isExpiringSoon(lot.expiryDate);
                                        const expired = isExpired(lot.expiryDate);
                                        return (
                                            <tr
                                                key={lot.id}
                                                className={`hover:bg-accent/30 transition-colors ${
                                                    expiring ? 'bg-yellow-500/5' : expired ? 'bg-red-500/5' : ''
                                                }`}
                                            >
                                                <td className="px-6 py-4 font-mono text-xs font-medium">{lot.lotNumber}</td>
                                                <td className="px-6 py-4">{lot.itemName}</td>
                                                <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">{lot.batchNumber}</td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        {lot.expiryDate ? (
                                                            <>
                                                                <span className={expired ? 'text-red-500 font-medium' : expiring ? 'text-yellow-500 font-medium' : ''}>
                                                                    {new Date(lot.expiryDate).toLocaleDateString()}
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
                                                    <Badge variant={expired ? 'error' : STATUS_VARIANT[lot.status] ?? 'default'}>
                                                        {expired && lot.status !== 'expired' ? 'expired' : lot.status}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (lots?.length ?? 0) > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
