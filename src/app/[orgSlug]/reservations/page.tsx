'use client';

import { Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Button } from '@/components/ui/base';
import { useReservations } from '@/hooks/useReservations';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildReservationColumns, STATUS_LABEL } from './reservation-columns';
import { Filter, Package, Search } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

const STATUS_FILTERS = ['All', 'pending', 'confirmed', 'consumed', 'released'];

export default function ReservationsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    // Search/status/page all go straight to the backend — GetReservationsByOrder (without an
    // order_id) now returns a real, paginated tenant-wide list instead of 400ing unconditionally
    // (MISSING_ORDER_ID), which is why this page could never load anything before.
    const { data: reservationsPage, isLoading, isError, refetch } = useReservations(orgSlug, {
        ...(search ? { search } : {}),
        ...(statusFilter !== 'All' ? { status: statusFilter } : {}),
        page,
        limit: pageSize,
    });

    const paginatedItems = reservationsPage?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((reservationsPage?.total ?? 0) / pageSize));

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
                                placeholder="Search by order ID..."
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
                        <DataTable
                            columns={columns}
                            rows={paginatedItems}
                            rowKey={(res) => res.id}
                            loading={isLoading}
                            loadingRows={8}
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
                            total={reservationsPage?.total}
                            pageSize={pageSize}
                            onPageSizeChange={setPageSize}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
