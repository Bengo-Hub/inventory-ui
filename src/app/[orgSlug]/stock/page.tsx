'use client';

import { Badge, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { apiClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, BookOpen, Search } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

const ITEMS_PER_PAGE = 25;

interface StockLevel {
    id: string;
    itemName: string;
    sku: string;
    warehouseName: string;
    warehouseId: string;
    available: number;
    reserved: number;
    reorderPoint: number | null;
    unit: string;
}

function stockStatus(available: number, reorderPoint: number | null): 'success' | 'warning' | 'error' | 'outline' {
    if (available <= 0) return 'error';
    if (reorderPoint != null && available <= reorderPoint) return 'warning';
    return 'success';
}

function stockLabel(available: number, reorderPoint: number | null): string {
    if (available <= 0) return 'Out of Stock';
    if (reorderPoint != null && available <= reorderPoint) return 'Low Stock';
    return 'In Stock';
}

export default function StockPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    const { data: stock, isLoading } = useQuery<StockLevel[]>({
        queryKey: ['stock', orgSlug, search],
        queryFn: () => {
            const p: Record<string, string> = {};
            if (search) p.search = search;
            return apiClient.get(`/api/v1/${orgSlug}/inventory/stock`, p);
        },
        placeholderData: [],
    });

    const totalPages = Math.max(1, Math.ceil((stock?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = stock?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    const lowStockCount = stock?.filter((s) => s.reorderPoint != null && s.available <= s.reorderPoint && s.available > 0).length ?? 0;
    const outOfStockCount = stock?.filter((s) => s.available <= 0).length ?? 0;

    useMemo(() => { setPage(1); }, [search]);

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Stock Levels</h1>
                <p className="text-muted-foreground mt-1">Real-time stock availability across all warehouses</p>
            </div>

            {(lowStockCount > 0 || outOfStockCount > 0) && (
                <div className="flex flex-wrap gap-3">
                    {outOfStockCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span className="text-sm font-medium">{outOfStockCount} item{outOfStockCount > 1 ? 's' : ''} out of stock</span>
                        </div>
                    )}
                    {lowStockCount > 0 && (
                        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-600 dark:text-yellow-400">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span className="text-sm font-medium">{lowStockCount} item{lowStockCount > 1 ? 's' : ''} below reorder point</span>
                        </div>
                    )}
                </div>
            )}

            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by item name, SKU, or warehouse..."
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
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Item</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">SKU</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Warehouse</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Available</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Reserved</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Reorder At</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading stock levels...
                                        </td>
                                    </tr>
                                ) : (stock?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No stock data available</p>
                                            <p className="text-xs text-muted-foreground/70 mt-1">Add items to warehouses to see stock levels here</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((item) => {
                                        const status = stockStatus(item.available, item.reorderPoint);
                                        return (
                                            <tr
                                                key={item.id}
                                                className={`hover:bg-accent/30 transition-colors ${
                                                    item.available <= 0 ? 'bg-red-500/5' :
                                                    (item.reorderPoint != null && item.available <= item.reorderPoint) ? 'bg-yellow-500/5' : ''
                                                }`}
                                            >
                                                <td className="px-6 py-4 font-medium">{item.itemName}</td>
                                                <td className="px-6 py-4 font-mono text-xs text-muted-foreground hidden md:table-cell">{item.sku}</td>
                                                <td className="px-6 py-4 text-muted-foreground hidden lg:table-cell">{item.warehouseName}</td>
                                                <td className="px-6 py-4 text-right font-semibold tabular-nums">
                                                    {item.available.toLocaleString()}
                                                    {item.unit && <span className="text-muted-foreground font-normal ml-1 text-xs">{item.unit}</span>}
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                                                    {item.reserved.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                                                    {item.reorderPoint != null ? item.reorderPoint.toLocaleString() : <span className="text-muted-foreground/40">—</span>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={status}>{stockLabel(item.available, item.reorderPoint)}</Badge>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (stock?.length ?? 0) > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
