'use client';

import { Badge, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Button } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { apiClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { Filter, Package, Search } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

const ITEMS_PER_PAGE = 20;

interface Reservation {
    id: string;
    orderId: string;
    orderRef?: string;
    itemId: string;
    itemSku: string;
    itemName: string;
    quantityReserved: number;
    warehouseName: string;
    status: 'confirmed' | 'consumed' | 'released';
    createdAt: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'outline' | 'warning' | 'error'> = {
    confirmed: 'default',
    consumed: 'success',
    released: 'outline',
};

const STATUS_LABEL: Record<string, string> = {
    confirmed: 'Confirmed',
    consumed: 'Consumed',
    released: 'Released',
};

const STATUS_FILTERS = ['All', 'confirmed', 'consumed', 'released'];

export default function ReservationsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [page, setPage] = useState(1);

    const { data: reservations, isLoading } = useQuery<Reservation[]>({
        queryKey: ['reservations', orgSlug, search, statusFilter],
        queryFn: () => {
            const p: Record<string, string> = {};
            if (search) p.search = search;
            if (statusFilter !== 'All') p.status = statusFilter;
            return apiClient.get(`/api/v1/tenants/${orgSlug}/inventory/reservations`, p);
        },
        placeholderData: [],
    });

    const totalPages = Math.max(1, Math.ceil((reservations?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = reservations?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    useMemo(() => { setPage(1); }, [search, statusFilter]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Reservations</h1>
                    <p className="text-muted-foreground mt-1">Active stock reservations by order</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by order ID or item SKU..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
                            {STATUS_FILTERS.map((s) => (
                                <Button
                                    key={s}
                                    variant={statusFilter === s ? 'primary' : 'outline'}
                                    size="sm"
                                    onClick={() => setStatusFilter(s)}
                                >
                                    {s === 'All' ? 'All' : STATUS_LABEL[s] ?? s}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Order</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Item</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Qty Reserved</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Warehouse</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Created</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading reservations...
                                        </td>
                                    </tr>
                                ) : (reservations?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No reservations found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((res) => (
                                        <tr key={res.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs font-medium">
                                                {res.orderRef ?? res.orderId.slice(0, 8)}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div>
                                                    <span className="font-medium">{res.itemName}</span>
                                                    <span className="block text-xs text-muted-foreground font-mono">{res.itemSku}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-semibold tabular-nums">
                                                {res.quantityReserved.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">
                                                {res.warehouseName}
                                            </td>
                                            <td className="px-6 py-4">
                                                <Badge variant={STATUS_VARIANT[res.status] ?? 'default'}>
                                                    {STATUS_LABEL[res.status] ?? res.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground hidden sm:table-cell">
                                                {new Date(res.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (reservations?.length ?? 0) > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
