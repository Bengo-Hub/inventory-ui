'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { apiClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { Filter, Package, Search } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';

interface StockItem {
    id: string;
    sku: string;
    name: string;
    category: string;
    quantity: number;
    unit: string;
    reorderPoint: number;
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error'> = {
    in_stock: 'success',
    low_stock: 'warning',
    out_of_stock: 'error',
};

const STATUS_LABEL: Record<string, string> = {
    in_stock: 'In Stock',
    low_stock: 'Low Stock',
    out_of_stock: 'Out of Stock',
};

const CATEGORIES = ['All', 'Raw Materials', 'Finished Goods', 'Packaging', 'Supplies', 'Equipment'];

export default function CatalogPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');

    const { data: items, isLoading } = useQuery<StockItem[]>({
        queryKey: ['catalog', orgSlug, search, category],
        queryFn: () => {
            const params: Record<string, string> = {};
            if (search) params.search = search;
            if (category !== 'All') params.category = category;
            return apiClient.get(`/api/v1/tenants/${orgSlug}/inventory/items`, params);
        },
        placeholderData: [],
    });

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Stock Catalog</h1>
                    <p className="text-muted-foreground mt-1">Manage your inventory items</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col md:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by SKU or name..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            {CATEGORIES.map((cat) => (
                                <Button
                                    key={cat}
                                    variant={category === cat ? 'primary' : 'outline'}
                                    size="sm"
                                    onClick={() => setCategory(cat)}
                                >
                                    {cat}
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
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">SKU</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Category</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Qty</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Unit</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading items...
                                        </td>
                                    </tr>
                                ) : (items?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <Package className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No items found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    items?.map((item) => (
                                        <tr key={item.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs">{item.sku}</td>
                                            <td className="px-6 py-4">
                                                <Link
                                                    href={`/${orgSlug}/catalog/${item.id}`}
                                                    className="font-medium hover:text-primary transition-colors"
                                                >
                                                    {item.name}
                                                </Link>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">{item.category}</td>
                                            <td className="px-6 py-4 text-right font-semibold tabular-nums">{item.quantity.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-muted-foreground hidden sm:table-cell">{item.unit}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={STATUS_VARIANT[item.status] ?? 'default'}>
                                                    {STATUS_LABEL[item.status] ?? item.status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
