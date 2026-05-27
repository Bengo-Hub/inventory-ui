'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ItemFormDialog } from '@/components/inventory/ItemFormDialog';
import { apiClient } from '@/lib/api/client';
import { useCreateItem } from '@/hooks/useItems';
import { type CreateItemInput } from '@/lib/api/items';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pagination } from '@/components/ui/pagination';
import { Filter, Package, Plus, Search, Upload } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, useMemo, useState } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

interface StockItem {
    id: string;
    sku: string;
    name: string;
    category_name?: string;
    type: string;
    is_active: boolean;
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
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState('All');
    const [page, setPage] = useState(1);
    const [createOpen, setCreateOpen] = useState(false);

    const createItem = useCreateItem(orgSlug);

    const importMutation = useMutation({
        mutationFn: (file: File) => {
            const formData = new FormData();
            formData.append('file', file);
            return apiClient.post(`/api/v1/${orgSlug}/inventory/items/import`, formData);
        },
        onSuccess: () => {
            toast.success('Items imported successfully');
            queryClient.invalidateQueries({ queryKey: ['catalog'] });
        },
        onError: () => {
            toast.error('Failed to import items');
        },
    });

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            if (!file.name.endsWith('.csv')) {
                toast.error('Please select a CSV file');
                return;
            }
            importMutation.mutate(file);
        }
        // Reset input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    const { data: items, isLoading } = useQuery<StockItem[]>({
        queryKey: ['catalog', orgSlug, search, category],
        queryFn: async () => {
            const p: Record<string, string> = {};
            if (search) p.search = search;
            if (category !== 'All') p.category = category;
            const res = await apiClient.get<{ data: StockItem[]; total: number } | StockItem[]>(`/api/v1/${orgSlug}/inventory/items`, p);
            return Array.isArray(res) ? res : (res as { data: StockItem[] }).data ?? [];
        },
        placeholderData: [],
    });

    const totalPages = Math.max(1, Math.ceil((items?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = items?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    // Reset to page 1 when filters change
    useMemo(() => { setPage(1); }, [search, category]);

    return (
        <>
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Stock Catalog</h1>
                    <p className="text-muted-foreground mt-1">Manage your inventory items</p>
                </div>
                <div className="flex items-center gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={importMutation.isPending}
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        {importMutation.isPending ? 'Importing...' : 'Import CSV'}
                    </Button>
                    <Button onClick={() => setCreateOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Item
                    </Button>
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
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Type</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Kind</th>
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
                                    paginatedItems.map((item) => (
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
                                            <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">{item.category_name ?? '—'}</td>
                                            <td className="px-6 py-4 text-right font-semibold tabular-nums capitalize">{item.type?.toLowerCase() ?? '—'}</td>
                                            <td className="px-6 py-4 text-muted-foreground hidden sm:table-cell capitalize">{item.type?.toLowerCase() ?? '—'}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={item.is_active ? 'success' : 'outline'}>
                                                    {item.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (items?.length ?? 0) > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>
        </div>

        {createOpen && (
            <ItemFormDialog
                orgSlug={orgSlug}
                item={null}
                onClose={() => setCreateOpen(false)}
                isPending={createItem.isPending}
                onSubmit={(data: CreateItemInput) => {
                    createItem.mutate(data, {
                        onSuccess: () => {
                            toast.success('Item created');
                            setCreateOpen(false);
                            queryClient.invalidateQueries({ queryKey: ['catalog'] });
                        },
                        onError: () => toast.error('Failed to create item'),
                    });
                }}
            />
        )}
        </>
    );
}
