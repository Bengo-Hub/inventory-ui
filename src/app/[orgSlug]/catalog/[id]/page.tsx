'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ItemFormDialog } from '@/components/inventory/ItemFormDialog';
import { apiClient } from '@/lib/api/client';
import { useDeleteItem, useUpdateItem } from '@/hooks/useItems';
import { useItemPricing, usePricingTiers, useUpsertItemPricing } from '@/hooks/usePricing';
import type { PricingTier } from '@/lib/api/pricing';
import { useSuppliers } from '@/hooks/useSuppliers';
import { type Item } from '@/lib/api/items';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowLeft, BoxIcon, ChefHat, DollarSign, GitBranch, History, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';

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

interface SerialRow {
    id: string;
    serial_number: string;
    status: 'available' | 'reserved' | 'sold' | 'returned' | 'defective';
    received_at?: string;
    sold_at?: string | null;
}

export default function ItemDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;
    const id = params?.id as string;
    const [editOpen, setEditOpen] = useState(false);

    const updateItem = useUpdateItem(orgSlug);
    const deleteItem = useDeleteItem(orgSlug);

    const { data: item, isLoading } = useQuery<ItemDetail>({
        queryKey: ['catalog', 'item', orgSlug, id],
        queryFn: () => apiClient.get(`/api/v1/${orgSlug}/inventory/items/${id}`),
        enabled: !!id,
    });

    const { data: history } = useQuery<StockHistoryEntry[]>({
        queryKey: ['catalog', 'history', orgSlug, id],
        queryFn: () => apiClient.get(`/api/v1/${orgSlug}/inventory/items/${id}/history`),
        enabled: !!id,
        placeholderData: [],
    });

    // Per-unit serials (serial-tracked items). The section renders only when rows exist.
    const { data: serialRows } = useQuery<SerialRow[]>({
        queryKey: ['catalog', 'serials', orgSlug, id],
        queryFn: () => apiClient.get(`/api/v1/${orgSlug}/inventory/items/${id}/serials`),
        enabled: !!id,
        placeholderData: [],
    });

    const { data: itemPricing } = useItemPricing(orgSlug, id);
    const { data: pricingTiers } = usePricingTiers(orgSlug);
    const upsertPricing = useUpsertItemPricing(orgSlug);
    const [pricingEditOpen, setPricingEditOpen] = useState(false);
    const [tierPrices, setTierPrices] = useState<Record<string, string>>({});

    function openPricingEditor() {
        const seed: Record<string, string> = {};
        for (const p of itemPricing ?? []) {
            if (p.price > 0) seed[p.pricing_tier_id] = String(p.price);
        }
        setTierPrices(seed);
        setPricingEditOpen(true);
    }

    function savePricing() {
        const entries = Object.entries(tierPrices)
            .map(([pricing_tier_id, v]) => ({ pricing_tier_id, price: Number(v), currency: 'KES' }))
            .filter((e) => Number.isFinite(e.price) && e.price > 0);
        if (entries.length === 0) {
            toast.error('Enter at least one tier price');
            return;
        }
        upsertPricing.mutate(
            { itemId: id, entries },
            {
                onSuccess: () => { toast.success('Pricing updated'); setPricingEditOpen(false); },
                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update pricing')),
            },
        );
    }

    const { data: suppliersPage } = useSuppliers(orgSlug);
    const suppliers = suppliersPage?.data;

    const [reorderEditMode, setReorderEditMode] = useState(false);
    const [reorderLevel, setReorderLevel] = useState('');
    const [reorderQty, setReorderQty] = useState('');
    const [autoReorder, setAutoReorder] = useState(false);
    const [preferredSupplierId, setPreferredSupplierId] = useState('');

    const reorderConfigMutation = useMutation({
        mutationFn: (data: { reorder_level: number; reorder_quantity: number; auto_reorder_enabled: boolean; preferred_supplier_id?: string }) =>
            apiClient.put(`/api/v1/${orgSlug}/inventory/stock/${item?.sku}/reorder-config`, {
                ...data,
                warehouse_id: item?.warehouseId,
            }),
        onSuccess: () => {
            toast.success('Reorder configuration saved');
            setReorderEditMode(false);
        },
        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to save reorder configuration')),
    });

    if (isLoading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-100">
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
        <>
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
                <div className="ml-auto flex items-center gap-3">
                    <Link href={`/${orgSlug}/catalog/${id}/recipe`}>
                        <Button variant="outline" size="sm">
                            <ChefHat className="h-4 w-4 mr-2" />
                            View Recipe
                        </Button>
                    </Link>
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive border-destructive hover:bg-destructive/10"
                        disabled={deleteItem.isPending}
                        onClick={() => {
                            if (!confirm(`Delete "${item.name}"? This cannot be undone.`)) return;
                            deleteItem.mutate(item.sku, {
                                onSuccess: () => {
                                    toast.success('Item deleted');
                                    router.push(`/${orgSlug}/catalog`);
                                },
                                onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to delete item')),
                            });
                        }}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </Button>
                    <Badge variant={statusVariant}>
                        {item.status.replace('_', ' ')}
                    </Badge>
                </div>
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

            {/* Item Pricing */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Pricing</h2>
                        </div>
                        <Button variant="outline" size="sm" onClick={openPricingEditor}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {(itemPricing?.length ?? 0) === 0 ? (
                        <div className="p-6 text-center text-muted-foreground text-sm">
                            No custom pricing configured — standard price applies.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Pricing Tier</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Basis</th>
                                        <th className="text-right px-6 py-3 font-medium text-muted-foreground">Price</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Currency</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {itemPricing?.map((p) => (
                                        <tr key={`${p.pricing_tier_id}-${p.outlet_id ?? 'all'}`} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-3 font-medium">{p.tier_name ?? p.tier_code ?? p.pricing_tier_id}{p.outlet_id ? ' (outlet)' : ''}</td>
                                            <td className="px-6 py-3 text-muted-foreground hidden sm:table-cell capitalize">{(p.tier_basis ?? 'default').replace(/_/g, ' ')}</td>
                                            <td className="px-6 py-3 text-right font-semibold tabular-nums">{p.price.toLocaleString()}</td>
                                            <td className="px-6 py-3 text-muted-foreground hidden sm:table-cell">{p.currency ?? 'KES'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Serial units — only for serial-tracked items that have received units */}
            {(serialRows?.length ?? 0) > 0 && (
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Serial Units</h2>
                            <div className="flex gap-1.5">
                                {(['available', 'sold', 'returned', 'defective'] as const).map((st) => {
                                    const n = (serialRows ?? []).filter((s) => s.status === st).length;
                                    return n > 0 ? <Badge key={st} variant={st === 'available' ? 'success' : 'outline'}>{n} {st}</Badge> : null;
                                })}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto max-h-96">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Serial Number</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Status</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Received</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Sold</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {(serialRows ?? []).map((s) => (
                                        <tr key={s.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-3 font-mono">{s.serial_number}</td>
                                            <td className="px-6 py-3">
                                                <Badge variant={s.status === 'available' ? 'success' : 'outline'} className="capitalize">{s.status}</Badge>
                                            </td>
                                            <td className="px-6 py-3 text-muted-foreground hidden sm:table-cell">{s.received_at ? new Date(s.received_at).toLocaleDateString() : '—'}</td>
                                            <td className="px-6 py-3 text-muted-foreground hidden sm:table-cell">{s.sold_at ? new Date(s.sold_at).toLocaleDateString() : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {pricingEditOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setPricingEditOpen(false)} />
                    <div className="relative z-50 w-full max-w-md mx-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">Edit Pricing</h2>
                                    <button onClick={() => setPricingEditOpen(false)} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {((pricingTiers ?? []) as PricingTier[]).filter((t) => t.is_active).length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No pricing profiles defined yet. Create them under Pricing Profiles first.</p>
                                ) : (
                                    <div className="space-y-3">
                                        {((pricingTiers ?? []) as PricingTier[]).filter((t) => t.is_active).map((t) => (
                                            <div key={t.id} className="flex items-center gap-3">
                                                <label className="flex-1 text-sm font-medium">
                                                    {t.name}
                                                    {t.is_default && <span className="ml-1 text-xs text-muted-foreground">(default)</span>}
                                                </label>
                                                <div className="relative w-36">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">KES</span>
                                                    <Input
                                                        type="number"
                                                        inputMode="decimal"
                                                        className="pl-10 text-right"
                                                        placeholder="0"
                                                        value={tierPrices[t.id] ?? ''}
                                                        onChange={(e) => setTierPrices((prev) => ({ ...prev, [t.id]: e.target.value }))}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className="flex gap-3 pt-2">
                                    <Button type="button" variant="outline" className="flex-1" onClick={() => setPricingEditOpen(false)}>Cancel</Button>
                                    <Button type="button" className="flex-1" onClick={savePricing} disabled={upsertPricing.isPending}>
                                        {upsertPricing.isPending ? 'Saving...' : 'Save'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Reorder Configuration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <RefreshCw className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold">Reorder Configuration</h2>
                        </div>
                        {!reorderEditMode && (
                            <Button variant="outline" size="sm" onClick={() => {
                                setReorderLevel(String(item.reorderPoint));
                                setReorderQty('');
                                setAutoReorder(false);
                                setPreferredSupplierId('');
                                setReorderEditMode(true);
                            }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Configure
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {reorderEditMode ? (
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            reorderConfigMutation.mutate({
                                reorder_level: Number(reorderLevel) || 0,
                                reorder_quantity: Number(reorderQty) || 0,
                                auto_reorder_enabled: autoReorder,
                                preferred_supplier_id: preferredSupplierId || undefined,
                            });
                        }} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Reorder Level ({item.unit})</label>
                                    <Input type="number" min="0" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Reorder Quantity ({item.unit})</label>
                                    <Input type="number" min="0" value={reorderQty} onChange={(e) => setReorderQty(e.target.value)} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">Preferred Supplier</label>
                                <select
                                    value={preferredSupplierId}
                                    onChange={(e) => setPreferredSupplierId(e.target.value)}
                                    className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                >
                                    <option value="">— None —</option>
                                    {suppliers?.map((s) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input type="checkbox" checked={autoReorder} onChange={(e) => setAutoReorder(e.target.checked)} className="rounded" />
                                <span className="text-sm font-medium">Enable auto-reorder when stock falls below reorder level</span>
                            </label>
                            <div className="flex gap-3 pt-2">
                                <Button type="button" variant="outline" className="flex-1" onClick={() => setReorderEditMode(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit" className="flex-1" disabled={reorderConfigMutation.isPending}>
                                    {reorderConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                                </Button>
                            </div>
                        </form>
                    ) : (
                        <dl className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <dt className="text-muted-foreground">Reorder Point</dt>
                                <dd className="font-medium mt-1">{item.reorderPoint.toLocaleString()} {item.unit}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">Auto Reorder</dt>
                                <dd className="font-medium mt-1 text-muted-foreground italic">Click &quot;Configure&quot; to set up</dd>
                            </div>
                        </dl>
                    )}
                </CardContent>
            </Card>

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

        {editOpen && (
            <ItemFormDialog
                orgSlug={orgSlug}
                item={item as unknown as Item}
                onClose={() => setEditOpen(false)}
                isPending={updateItem.isPending}
                onSubmit={(data) => {
                    updateItem.mutate({ sku: item.sku, data }, {
                        onSuccess: () => {
                            toast.success('Item updated');
                            setEditOpen(false);
                        },
                        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to update item')),
                    });
                }}
            />
        )}
        </>
    );
}
