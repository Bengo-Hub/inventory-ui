'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { apiClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, Plus, Search, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';

const ITEMS_PER_PAGE = 20;

interface PurchaseOrderLineItem {
    id: string;
    itemName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    total: number;
}

interface PurchaseOrder {
    id: string;
    poNumber: string;
    supplierName: string;
    supplierId: string;
    status: 'draft' | 'sent' | 'partially_received' | 'received' | 'cancelled';
    total: number;
    createdAt: string;
    lineItems?: PurchaseOrderLineItem[];
}

const STATUS_VARIANT: Record<string, 'default' | 'success' | 'warning' | 'error' | 'outline'> = {
    draft: 'outline',
    sent: 'default',
    partially_received: 'warning',
    received: 'success',
    cancelled: 'error',
};

const STATUS_LABEL: Record<string, string> = {
    draft: 'Draft',
    sent: 'Sent',
    partially_received: 'Partial',
    received: 'Received',
    cancelled: 'Cancelled',
};

export default function PurchaseOrdersPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [selectedPO, setSelectedPO] = useState<string | null>(null);

    const { data: orders, isLoading } = useQuery<PurchaseOrder[]>({
        queryKey: ['purchase-orders', orgSlug, search],
        queryFn: () => {
            const p: Record<string, string> = {};
            if (search) p.search = search;
            return apiClient.get(`/api/v1/${orgSlug}/inventory/purchase-orders`, p);
        },
        placeholderData: [],
    });

    const { data: poDetail } = useQuery<PurchaseOrder>({
        queryKey: ['purchase-orders', 'detail', orgSlug, selectedPO],
        queryFn: () => apiClient.get(`/api/v1/${orgSlug}/inventory/purchase-orders/${selectedPO}`),
        enabled: !!selectedPO,
    });

    const totalPages = Math.max(1, Math.ceil((orders?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = orders?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    useMemo(() => { setPage(1); }, [search]);

    // Detail view
    if (selectedPO && poDetail) {
        return (
            <div className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedPO(null)}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">{poDetail.poNumber}</h1>
                        <p className="text-muted-foreground text-sm">{poDetail.supplierName}</p>
                    </div>
                    <Badge variant={STATUS_VARIANT[poDetail.status] ?? 'default'} className="ml-auto">
                        {STATUS_LABEL[poDetail.status] ?? poDetail.status}
                    </Badge>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2">
                        <CardHeader>
                            <h2 className="text-lg font-semibold">Line Items</h2>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/30">
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Item</th>
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">SKU</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Qty</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Unit Price</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(poDetail.lineItems?.length ?? 0) === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                                                    No line items
                                                </td>
                                            </tr>
                                        ) : (
                                            poDetail.lineItems?.map((line) => (
                                                <tr key={line.id} className="hover:bg-accent/30 transition-colors">
                                                    <td className="px-6 py-3 font-medium">{line.itemName}</td>
                                                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{line.sku}</td>
                                                    <td className="px-6 py-3 text-right tabular-nums">{line.quantity}</td>
                                                    <td className="px-6 py-3 text-right tabular-nums">{line.unitPrice.toLocaleString()}</td>
                                                    <td className="px-6 py-3 text-right font-semibold tabular-nums">{line.total.toLocaleString()}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    {(poDetail.lineItems?.length ?? 0) > 0 && (
                                        <tfoot>
                                            <tr className="border-t-2 border-border bg-muted/30">
                                                <td colSpan={4} className="px-6 py-3 text-right font-semibold">Grand Total</td>
                                                <td className="px-6 py-3 text-right font-bold tabular-nums">{poDetail.total.toLocaleString()}</td>
                                            </tr>
                                        </tfoot>
                                    )}
                                </table>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <h2 className="text-lg font-semibold">Order Info</h2>
                        </CardHeader>
                        <CardContent>
                            <dl className="space-y-4 text-sm">
                                <div>
                                    <dt className="text-muted-foreground">PO Number</dt>
                                    <dd className="font-medium mt-1 font-mono">{poDetail.poNumber}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Supplier</dt>
                                    <dd className="font-medium mt-1">{poDetail.supplierName}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Date</dt>
                                    <dd className="font-medium mt-1">{new Date(poDetail.createdAt).toLocaleDateString()}</dd>
                                </div>
                                <div>
                                    <dt className="text-muted-foreground">Total</dt>
                                    <dd className="font-bold text-lg mt-1">{poDetail.total.toLocaleString()}</dd>
                                </div>
                            </dl>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    // List view
    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
                    <p className="text-muted-foreground mt-1">Track orders from your suppliers</p>
                </div>
                <Button onClick={() => { /* TODO: open create PO dialog */ }}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Order
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by PO number or supplier..."
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
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">PO Number</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Supplier</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Total</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading purchase orders...
                                        </td>
                                    </tr>
                                ) : (orders?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No purchase orders found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((po) => (
                                        <tr
                                            key={po.id}
                                            className="hover:bg-accent/30 transition-colors cursor-pointer"
                                            onClick={() => setSelectedPO(po.id)}
                                        >
                                            <td className="px-6 py-4 font-mono text-xs font-medium">{po.poNumber}</td>
                                            <td className="px-6 py-4">{po.supplierName}</td>
                                            <td className="px-6 py-4">
                                                <Badge variant={STATUS_VARIANT[po.status] ?? 'default'}>
                                                    {STATUS_LABEL[po.status] ?? po.status}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right font-semibold tabular-nums hidden sm:table-cell">
                                                {po.total.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">
                                                {new Date(po.createdAt).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (orders?.length ?? 0) > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
