'use client';

import { Badge, Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { apiClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BoxIcon, GitBranch, History } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface ItemDetail {
    id: string;
    sku: string;
    name: string;
    description: string;
    category: string;
    quantity: number;
    unit: string;
    reorderPoint: number;
    status: 'in_stock' | 'low_stock' | 'out_of_stock';
    warehouseId: string;
    warehouseName: string;
    bom: BomEntry[];
}

interface BomEntry {
    ingredientId: string;
    ingredientName: string;
    quantityRequired: number;
    unit: string;
}

interface StockHistoryEntry {
    id: string;
    type: string;
    delta: number;
    reason: string;
    createdAt: string;
    createdBy: string;
}

export default function ItemDetailPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const id = params?.id as string;

    const { data: item, isLoading } = useQuery<ItemDetail>({
        queryKey: ['catalog', 'item', orgSlug, id],
        queryFn: () => apiClient.get(`/api/v1/tenants/${orgSlug}/inventory/items/${id}`),
        enabled: !!id,
    });

    const { data: history } = useQuery<StockHistoryEntry[]>({
        queryKey: ['catalog', 'history', orgSlug, id],
        queryFn: () => apiClient.get(`/api/v1/tenants/${orgSlug}/inventory/items/${id}/history`),
        enabled: !!id,
        placeholderData: [],
    });

    if (isLoading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <div className="animate-pulse text-muted-foreground">Loading item...</div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="p-6 text-center">
                <p className="text-muted-foreground">Item not found</p>
                <Link href={`/${orgSlug}/catalog`}>
                    <Button variant="outline" className="mt-4">Back to Catalog</Button>
                </Link>
            </div>
        );
    }

    const statusVariant = item.status === 'in_stock' ? 'success' : item.status === 'low_stock' ? 'warning' : 'error';

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Link href={`/${orgSlug}/catalog`}>
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
                    <p className="text-muted-foreground font-mono text-sm">{item.sku}</p>
                </div>
                <Badge variant={statusVariant} className="ml-auto">
                    {item.status.replace('_', ' ')}
                </Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <BoxIcon className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Item Details</h2>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <dl className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <dt className="text-muted-foreground">Category</dt>
                                <dd className="font-medium mt-1">{item.category}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">Quantity on Hand</dt>
                                <dd className="font-medium mt-1">{item.quantity.toLocaleString()} {item.unit}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">Reorder Point</dt>
                                <dd className="font-medium mt-1">{item.reorderPoint.toLocaleString()} {item.unit}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">Warehouse</dt>
                                <dd className="font-medium mt-1">{item.warehouseName}</dd>
                            </div>
                            {item.description && (
                                <div className="col-span-2">
                                    <dt className="text-muted-foreground">Description</dt>
                                    <dd className="font-medium mt-1">{item.description}</dd>
                                </div>
                            )}
                        </dl>
                    </CardContent>
                </Card>

                {item.bom && item.bom.length > 0 && (
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <GitBranch className="h-5 w-5 text-primary" />
                                <h2 className="text-lg font-semibold">BOM / Recipe</h2>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="divide-y divide-border">
                                {item.bom.map((entry) => (
                                    <div key={entry.ingredientId} className="flex justify-between items-center px-6 py-3 text-sm">
                                        <span className="font-medium">{entry.ingredientName}</span>
                                        <span className="text-muted-foreground tabular-nums">
                                            {entry.quantityRequired} {entry.unit}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>

            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold">Stock History</h2>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {(history?.length ?? 0) === 0 ? (
                        <div className="p-6 text-center text-muted-foreground">No history available</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Date</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Type</th>
                                        <th className="text-right px-6 py-3 font-medium text-muted-foreground">Change</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Reason</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">By</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {history?.map((entry) => (
                                        <tr key={entry.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-3 text-muted-foreground">
                                                {new Date(entry.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-3 capitalize">{entry.type}</td>
                                            <td className={`px-6 py-3 text-right font-semibold tabular-nums ${entry.delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {entry.delta > 0 ? '+' : ''}{entry.delta}
                                            </td>
                                            <td className="px-6 py-3">{entry.reason}</td>
                                            <td className="px-6 py-3 text-muted-foreground hidden md:table-cell">{entry.createdBy}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
