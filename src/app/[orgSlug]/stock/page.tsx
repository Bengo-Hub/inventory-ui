'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { useStock, useCreateAdjustment, useAdjustments } from '@/hooks/useStock';
import { useWarehouses } from '@/hooks/useWarehouses';
import type { StockLevel } from '@/lib/api/stock';
import { AlertTriangle, BookOpen, Minus, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 25;

const REASON_OPTIONS = [
    { value: 'correction', label: 'Count Correction' },
    { value: 'damaged', label: 'Damaged Goods' },
    { value: 'expired', label: 'Expired / Spoiled' },
    { value: 'shrinkage', label: 'Theft / Unexplained Loss' },
    { value: 'found', label: 'Found / Surplus Discovered' },
    { value: 'initial_count', label: 'Initial Stock Count' },
    { value: 'return', label: 'Customer Return' },
    { value: 'other', label: 'Other' },
];

function stockStatus(available: number, reorderPoint?: number): 'success' | 'warning' | 'error' | 'outline' {
    if (available <= 0) return 'error';
    if (reorderPoint != null && available <= reorderPoint) return 'warning';
    return 'success';
}

function stockLabel(available: number, reorderPoint?: number): string {
    if (available <= 0) return 'Out of Stock';
    if (reorderPoint != null && available <= reorderPoint) return 'Low Stock';
    return 'In Stock';
}

function StockDrawer({
    item,
    orgSlug,
    onClose,
}: {
    item: StockLevel;
    orgSlug: string;
    onClose: () => void;
}) {
    const [adjType, setAdjType] = useState<'add' | 'remove'>('add');
    const [adjItemSku, setAdjItemSku] = useState(item.sku);
    const [adjItemName, setAdjItemName] = useState(item.item_name);
    const [adjQty, setAdjQty] = useState('');
    const [adjReason, setAdjReason] = useState('');
    const [adjNotes, setAdjNotes] = useState('');
    const [adjWarehouseId, setAdjWarehouseId] = useState(item.warehouse_id ?? '');
    const [showAdjForm, setShowAdjForm] = useState(false);

    const { data: warehouses } = useWarehouses(orgSlug);
    const { data: recentAdj } = useAdjustments(orgSlug);
    const createAdj = useCreateAdjustment(orgSlug);

    const itemAdj = useMemo(() =>
        recentAdj?.filter((a) => a.itemId === item.id || a.itemName === item.item_name).slice(0, 5),
        [recentAdj, item]
    );

    const status = stockStatus(item.available, item.reorder_point);

    function handleAdjSubmit(e: React.FormEvent) {
        e.preventDefault();
        const qty = parseInt(adjQty, 10);
        if (!adjItemSku || isNaN(qty) || qty <= 0 || !adjReason) {
            toast.error('Fill in all required fields');
            return;
        }
        const reasonText = adjReason === 'other'
            ? `other: ${adjNotes.trim()}`
            : REASON_OPTIONS.find((r) => r.value === adjReason)?.label ?? adjReason;

        createAdj.mutate({
            sku: adjItemSku,
            adjustment: adjType === 'add' ? qty : -qty,
            reason: reasonText,
            notes: adjNotes.trim() || undefined,
            warehouse_id: adjWarehouseId || undefined,
        }, {
            onSuccess: () => {
                toast.success('Adjustment recorded');
                setAdjQty('');
                setAdjReason('');
                setAdjNotes('');
                setShowAdjForm(false);
            },
            onError: () => toast.error('Failed to record adjustment'),
        });
    }

    return (
        <Sheet open onClose={onClose} width="md">
            <SheetHeader>
                <SheetTitle>{item.item_name}</SheetTitle>
                <button
                    type="button"
                    onClick={onClose}
                    className="p-1 rounded-lg hover:bg-accent text-muted-foreground transition-colors"
                >
                    ✕
                </button>
            </SheetHeader>
            <SheetContent>
                {/* SKU + Warehouse */}
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="font-mono">{item.sku}</span>
                    <span>•</span>
                    <span>{item.warehouse_name}</span>
                </div>

                {/* Status */}
                <div>
                    <Badge variant={status}>{stockLabel(item.available, item.reorder_point)}</Badge>
                </div>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Available', value: item.available.toLocaleString(), color: item.available <= 0 ? 'text-destructive' : 'text-foreground' },
                        { label: 'Reserved', value: item.reserved.toLocaleString(), color: 'text-foreground' },
                        { label: 'Reorder At', value: item.reorder_point != null ? item.reorder_point.toLocaleString() : '—', color: 'text-foreground' },
                    ].map(({ label, value, color }) => (
                        <div key={label} className="rounded-xl bg-muted/40 p-3 text-center">
                            <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
                            <p className="text-xs text-muted-foreground mt-1">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Adjust Stock toggle */}
                <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold">Record Adjustment</h3>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowAdjForm((p) => !p)}
                        >
                            {showAdjForm ? 'Cancel' : '+ Adjust'}
                        </Button>
                    </div>

                    {showAdjForm && (
                        <form onSubmit={handleAdjSubmit} className="space-y-3">
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={adjType === 'add' ? 'primary' : 'outline'}
                                    onClick={() => setAdjType('add')}
                                    className="flex-1"
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={adjType === 'remove' ? 'destructive' : 'outline'}
                                    onClick={() => setAdjType('remove')}
                                    className="flex-1"
                                >
                                    <Minus className="h-3 w-3 mr-1" /> Remove
                                </Button>
                            </div>

                            <ItemSearchInput
                                orgSlug={orgSlug}
                                value={adjItemName}
                                label="Item *"
                                placeholder="Search item..."
                                onSelect={(found) => {
                                    setAdjItemSku(found.sku);
                                    setAdjItemName(found.name);
                                }}
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium">Quantity *</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        min="1"
                                        value={adjQty}
                                        onChange={(e) => setAdjQty(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium">Warehouse</label>
                                    <select
                                        value={adjWarehouseId}
                                        onChange={(e) => setAdjWarehouseId(e.target.value)}
                                        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                    >
                                        <option value="">All</option>
                                        {warehouses?.map((wh) => (
                                            <option key={wh.id} value={wh.id}>{wh.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-medium">Reason *</label>
                                <select
                                    value={adjReason}
                                    onChange={(e) => setAdjReason(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                >
                                    <option value="">Select reason...</option>
                                    {REASON_OPTIONS.map((r) => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            {adjReason === 'other' && (
                                <textarea
                                    placeholder="Describe reason..."
                                    value={adjNotes}
                                    onChange={(e) => setAdjNotes(e.target.value)}
                                    rows={2}
                                    className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                                />
                            )}

                            <Button type="submit" className="w-full" size="sm" disabled={createAdj.isPending}>
                                {createAdj.isPending ? 'Recording...' : `Record ${adjType === 'add' ? 'Addition' : 'Removal'}`}
                            </Button>
                        </form>
                    )}
                </div>

                {/* Recent adjustments */}
                {(itemAdj?.length ?? 0) > 0 && (
                    <div className="border-t border-border pt-4">
                        <h3 className="text-sm font-semibold mb-2">Recent Adjustments</h3>
                        <div className="space-y-1.5">
                            {itemAdj?.map((adj) => (
                                <div key={adj.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-muted/30">
                                    <span className="text-muted-foreground">{new Date(adj.createdAt).toLocaleDateString()}</span>
                                    <span className="text-muted-foreground capitalize">{adj.reason}</span>
                                    <span className={`font-semibold tabular-nums ${adj.quantity > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                                        {adj.quantity > 0 ? '+' : ''}{adj.quantity}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

export default function StockPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [selectedItem, setSelectedItem] = useState<StockLevel | null>(null);

    const { data: stock, isLoading } = useStock(orgSlug, { search: search || undefined });

    const totalPages = Math.max(1, Math.ceil((stock?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = stock?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    const lowStockCount = stock?.filter((s) => s.reorder_point != null && s.available <= s.reorder_point && s.available > 0).length ?? 0;
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
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading stock levels...
                                        </td>
                                    </tr>
                                ) : (stock?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center">
                                            <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No stock data available</p>
                                            <p className="text-xs text-muted-foreground/70 mt-1">Add items to warehouses to see stock levels here</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((item) => {
                                        const status = stockStatus(item.available, item.reorder_point);
                                        return (
                                            <tr
                                                key={item.id}
                                                className={`hover:bg-accent/30 transition-colors cursor-pointer ${
                                                    item.available <= 0 ? 'bg-red-500/5' :
                                                    (item.reorder_point != null && item.available <= item.reorder_point) ? 'bg-yellow-500/5' : ''
                                                }`}
                                                onClick={() => setSelectedItem(item)}
                                            >
                                                <td className="px-6 py-4 font-medium">{item.item_name}</td>
                                                <td className="px-6 py-4 font-mono text-xs text-muted-foreground hidden md:table-cell">{item.sku}</td>
                                                <td className="px-6 py-4 text-muted-foreground hidden lg:table-cell">{item.warehouse_name}</td>
                                                <td className="px-6 py-4 text-right font-semibold tabular-nums">
                                                    {item.available.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                                                    {item.reserved.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                                                    {item.reorder_point != null ? item.reorder_point.toLocaleString() : <span className="text-muted-foreground/40">—</span>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={status}>{stockLabel(item.available, item.reorder_point)}</Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Record Adjustment"
                                                        onClick={() => setSelectedItem(item)}
                                                    >
                                                        <SlidersHorizontal className="h-4 w-4" />
                                                    </Button>
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

            {selectedItem && (
                <StockDrawer
                    item={selectedItem}
                    orgSlug={orgSlug}
                    onClose={() => setSelectedItem(null)}
                />
            )}
        </div>
    );
}
