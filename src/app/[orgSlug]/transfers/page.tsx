'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { apiClient } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Package, Plus, Search, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

interface StockTransfer {
    id: string;
    fromWarehouseName: string;
    fromWarehouseId: string;
    toWarehouseName: string;
    toWarehouseId: string;
    status: 'pending' | 'in_transit' | 'completed' | 'cancelled';
    itemsCount: number;
    createdAt: string;
}

interface WarehouseOption {
    id: string;
    name: string;
}

interface TransferPayload {
    fromWarehouseId: string;
    toWarehouseId: string;
    items: { itemId: string; quantity: number }[];
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    pending: 'outline',
    in_transit: 'warning',
    completed: 'success',
    cancelled: 'error',
};

const STATUS_LABEL: Record<string, string> = {
    pending: 'Pending',
    in_transit: 'In Transit',
    completed: 'Completed',
    cancelled: 'Cancelled',
};

export default function TransfersPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);

    // Create form state
    const [fromWarehouse, setFromWarehouse] = useState('');
    const [toWarehouse, setToWarehouse] = useState('');
    const [transferItems, setTransferItems] = useState<{ itemId: string; quantity: string }[]>([
        { itemId: '', quantity: '' },
    ]);

    const { data: transfers, isLoading } = useQuery<StockTransfer[]>({
        queryKey: ['transfers', orgSlug, search],
        queryFn: () => {
            const p: Record<string, string> = {};
            if (search) p.search = search;
            return apiClient.get(`/api/v1/tenants/${orgSlug}/inventory/transfers`, p);
        },
        placeholderData: [],
    });

    const { data: warehouses } = useQuery<WarehouseOption[]>({
        queryKey: ['warehouses', orgSlug],
        queryFn: () => apiClient.get(`/api/v1/tenants/${orgSlug}/inventory/warehouses`),
        placeholderData: [],
    });

    const mutation = useMutation({
        mutationFn: (payload: TransferPayload) =>
            apiClient.post(`/api/v1/tenants/${orgSlug}/inventory/transfers`, payload),
        onSuccess: () => {
            toast.success('Transfer created');
            queryClient.invalidateQueries({ queryKey: ['transfers'] });
            closeDialog();
        },
        onError: () => {
            toast.error('Failed to create transfer');
        },
    });

    const totalPages = Math.max(1, Math.ceil((transfers?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = transfers?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    useMemo(() => { setPage(1); }, [search]);

    function openCreate() {
        setFromWarehouse('');
        setToWarehouse('');
        setTransferItems([{ itemId: '', quantity: '' }]);
        setDialogOpen(true);
    }

    function closeDialog() {
        setDialogOpen(false);
    }

    function addItem() {
        setTransferItems([...transferItems, { itemId: '', quantity: '' }]);
    }

    function removeItem(index: number) {
        setTransferItems(transferItems.filter((_, i) => i !== index));
    }

    function updateItem(index: number, field: 'itemId' | 'quantity', value: string) {
        const updated = [...transferItems];
        updated[index] = { ...updated[index], [field]: value };
        setTransferItems(updated);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!fromWarehouse || !toWarehouse) {
            toast.error('Select source and destination warehouses');
            return;
        }
        if (fromWarehouse === toWarehouse) {
            toast.error('Source and destination must be different');
            return;
        }
        const validItems = transferItems
            .filter((i) => i.itemId.trim() && parseInt(i.quantity, 10) > 0)
            .map((i) => ({ itemId: i.itemId.trim(), quantity: parseInt(i.quantity, 10) }));

        if (validItems.length === 0) {
            toast.error('Add at least one item with a valid quantity');
            return;
        }

        mutation.mutate({
            fromWarehouseId: fromWarehouse,
            toWarehouseId: toWarehouse,
            items: validItems,
        });
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Stock Transfers</h1>
                    <p className="text-muted-foreground mt-1">Move inventory between warehouses</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Transfer
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search transfers..."
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
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Transfer ID</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">From</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">To</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Items</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading transfers...
                                        </td>
                                    </tr>
                                ) : (transfers?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <ArrowRightLeft className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No transfers found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((transfer) => (
                                        <tr key={transfer.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-4 font-mono text-xs">{transfer.id.slice(0, 8)}</td>
                                            <td className="px-6 py-4">{transfer.fromWarehouseName}</td>
                                            <td className="px-6 py-4">{transfer.toWarehouseName}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={STATUS_VARIANT[transfer.status] ?? 'default'}>
                                                    {STATUS_LABEL[transfer.status] ?? transfer.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right tabular-nums hidden sm:table-cell">
                                                <div className="flex items-center justify-end gap-1 text-muted-foreground">
                                                    <Package className="h-3 w-3" />
                                                    {transfer.itemsCount}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">
                                                {new Date(transfer.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (transfers?.length ?? 0) > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>

            {/* Create Transfer Dialog */}
            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
                    <div className="relative z-50 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">New Stock Transfer</h2>
                                    <button onClick={closeDialog} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">From Warehouse *</label>
                                            <select
                                                value={fromWarehouse}
                                                onChange={(e) => setFromWarehouse(e.target.value)}
                                                className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                                required
                                            >
                                                <option value="">Select source...</option>
                                                {warehouses?.map((wh) => (
                                                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">To Warehouse *</label>
                                            <select
                                                value={toWarehouse}
                                                onChange={(e) => setToWarehouse(e.target.value)}
                                                className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                                required
                                            >
                                                <option value="">Select dest...</option>
                                                {warehouses?.map((wh) => (
                                                    <option key={wh.id} value={wh.id}>{wh.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <label className="text-sm font-medium">Items *</label>
                                            <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                                                <Plus className="h-3 w-3 mr-1" />
                                                Add Item
                                            </Button>
                                        </div>
                                        {transferItems.map((item, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <Input
                                                    placeholder="Item ID / SKU"
                                                    value={item.itemId}
                                                    onChange={(e) => updateItem(idx, 'itemId', e.target.value)}
                                                    className="flex-1"
                                                />
                                                <Input
                                                    type="number"
                                                    placeholder="Qty"
                                                    min="1"
                                                    value={item.quantity}
                                                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                                                    className="w-24"
                                                />
                                                {transferItems.length > 1 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(idx)}
                                                        className="p-1 rounded hover:bg-accent text-muted-foreground"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex gap-3 pt-2">
                                        <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" className="flex-1" disabled={mutation.isPending}>
                                            {mutation.isPending ? 'Creating...' : 'Create Transfer'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
