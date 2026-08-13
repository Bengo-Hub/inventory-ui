'use client';

import { Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Button } from '@/components/ui/base';
import { apiClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildReservationColumns, STATUS_LABEL } from './reservation-columns';
import { Filter, Package, Search } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

export interface Reservation {
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

const STATUS_FILTERS = ['All', 'confirmed', 'consumed', 'released'];

export default function ReservationsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const { data: reservations, isLoading, isError, refetch } = useQuery<Reservation[]>({
        queryKey: ['reservations', orgSlug, search, statusFilter],
        queryFn: () => {
            const p: Record<string, string> = {};
            if (search) p.search = search;
            if (statusFilter !== 'All') p.status = statusFilter;
            return apiClient.get(`/api/v1/${orgSlug}/inventory/reservations`, p);
        },
        placeholderData: [],
    });

    const totalPages = Math.max(1, Math.ceil((reservations?.length ?? 0) / pageSize));
    const paginatedItems = reservations?.slice((page - 1) * pageSize, page * pageSize) ?? [];

    useMemo(() => { setPage(1); }, [search, statusFilter, pageSize]);

    const columns = useMemo(() => buildReservationColumns(), []);

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
                    <div className="px-2 pb-2">
                        <DataTable<Reservation>
                            columns={columns}
                            rows={paginatedItems}
                            rowKey={(res) => res.id}
                            loading={isLoading}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyState={
                                <>
                                    <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                    <p className="text-muted-foreground">No reservations found</p>
                                </>
                            }
                            storageKey="reservations-col-prefs"
                            page={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            total={reservations?.length}
                            pageSize={pageSize}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
