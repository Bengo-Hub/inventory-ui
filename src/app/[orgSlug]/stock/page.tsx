'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { useStock, useCreateAdjustment, useCreateBreakdown, useAdjustments } from '@/hooks/useStock';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useCategories } from '@/hooks/useCategories';
import { useUnits } from '@/hooks/useUnits';
import { SubscriptionGate } from '@/components/subscription/subscription-gate';
import type { StockLevel, StockListParams } from '@/lib/api/stock';
import { AlertTriangle, BookOpen, Minus, Plus, Search, SlidersHorizontal, Split } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';
import { usePermissions, P } from '@/hooks/usePermissions';

const ITEMS_PER_PAGE = 25;

// Only stockable item types appear on stock levels (mirrors the backend
// stockableTypes filter); services/vouchers/recipes never hold balances.
const STOCKABLE_TYPES = ['GOODS', 'INGREDIENT', 'EQUIPMENT'] as const;

type StatusFilter = 'all' | 'low' | 'out';

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
    canAdjust,
    initialAction,
}: {
    item: StockLevel;
    orgSlug: string;
    onClose: () => void;
    canAdjust: boolean;
    initialAction?: 'adjust' | 'breakdown';
}) {
    const [adjType, setAdjType] = useState<'add' | 'remove'>('add');
    const [adjItemSku, setAdjItemSku] = useState(item.sku);
    const [adjItemName, setAdjItemName] = useState(item.item_name);
    const [adjQty, setAdjQty] = useState('');
    const [adjReason, setAdjReason] = useState('');
    const [adjNotes, setAdjNotes] = useState('');
    const [adjWarehouseId, setAdjWarehouseId] = useState(item.warehouse_id ?? '');
    const [adjUnitId, setAdjUnitId] = useState(item.unit_id ?? '');
    const [showAdjForm, setShowAdjForm] = useState(initialAction === 'adjust');

    // Breakdown (bulk pack -> retail units): the clicked row is the parent SKU.
    const [showBreakdownForm, setShowBreakdownForm] = useState(initialAction === 'breakdown');
    const [bdChildSku, setBdChildSku] = useState('');
    const [bdChildName, setBdChildName] = useState('');
    const [bdParentQty, setBdParentQty] = useState('');
    const [bdConversion, setBdConversion] = useState('');
    const [bdNotes, setBdNotes] = useState('');

    const { data: warehouses } = useWarehouses(orgSlug);
    const { data: units } = useUnits(orgSlug);
    const { data: itemAdj } = useAdjustments(orgSlug, { item_id: item.id, limit: 5 });
    const createAdj = useCreateAdjustment(orgSlug);
    const createBreakdown = useCreateBreakdown(orgSlug);

    const status = stockStatus(item.available, item.reorder_point);

    function handleAdjSubmit(e: React.FormEvent) {
        e.preventDefault();
        const qty = parseFloat(adjQty);
        if (!adjItemSku || isNaN(qty) || qty <= 0 || !adjReason) {
            toast.error('Fill in all required fields');
            return;
        }

        createAdj.mutate({
            sku: adjItemSku,
            adjustment: adjType === 'add' ? qty : -qty,
            // Send the canonical enum value the backend validates against (not the label).
            reason: adjReason,
            notes: adjNotes.trim() || undefined,
            warehouse_id: adjWarehouseId || undefined,
            unit_id: adjUnitId || undefined,
        }, {
            onSuccess: () => {
                toast.success('Adjustment recorded');
                setAdjQty('');
                setAdjReason('');
                setAdjNotes('');
                setShowAdjForm(false);
            },
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to record adjustment')),
        });
    }

    function handleBreakdownSubmit(e: React.FormEvent) {
        e.preventDefault();
        const parentQty = parseFloat(bdParentQty);
        const conversion = parseFloat(bdConversion);
        if (!bdChildSku || isNaN(parentQty) || parentQty <= 0 || isNaN(conversion) || conversion <= 0) {
            toast.error('Fill in all required fields');
            return;
        }
        if (bdChildSku === item.sku) {
            toast.error('Child SKU must differ from the parent');
            return;
        }

        createBreakdown.mutate({
            parent_sku: item.sku,
            child_sku: bdChildSku,
            parent_quantity: parentQty,
            conversion_factor: conversion,
            warehouse_id: item.warehouse_id || undefined,
            notes: bdNotes.trim() || undefined,
        }, {
            onSuccess: () => {
                toast.success('Stock broken down');
                setBdChildSku('');
                setBdChildName('');
                setBdParentQty('');
                setBdConversion('');
                setBdNotes('');
                setShowBreakdownForm(false);
            },
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to break down stock')),
        });
    }

    return (
        <Sheet open onClose={onClose} width="md">
            <SheetHeader>
                <SheetTitle>{item.item_name}</SheetTitle>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close panel"
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

                {/* Adjust Stock toggle — gated by stock change permission AND the
                    stock_tracking subscription feature (matches the backend RequireFeature). */}
                {canAdjust && (
                <SubscriptionGate feature="stock_tracking">
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
                                    // Preselect the chosen item's unit of measure.
                                    setAdjUnitId(found.unit_id ?? '');
                                }}
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium">Quantity *</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        min="0"
                                        step="any"
                                        value={adjQty}
                                        onChange={(e) => setAdjQty(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium">Unit</label>
                                    <select
                                        value={adjUnitId}
                                        onChange={(e) => setAdjUnitId(e.target.value)}
                                        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                    >
                                        <option value="">{item.unit || 'Base unit'}</option>
                                        {units?.map((u) => (
                                            <option key={u.id} value={u.id}>
                                                {u.name}{u.abbreviation ? ` (${u.abbreviation})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
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
                </SubscriptionGate>
                )}

                {/* Breakdown — convert this bulk SKU (parent) into retail units of a child SKU.
                    Same gating as adjustments: stock change permission + stock_tracking feature
                    (mirrors the backend RequireFeature("stock_tracking") + PermStockChange). */}
                {canAdjust && (
                <SubscriptionGate feature="stock_tracking">
                <div className="border-t border-border pt-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold">Break Down Stock</h3>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowBreakdownForm((p) => !p)}
                        >
                            {showBreakdownForm ? 'Cancel' : <><Split className="h-3 w-3 mr-1" /> Breakdown</>}
                        </Button>
                    </div>

                    {showBreakdownForm && (
                        <form onSubmit={handleBreakdownSubmit} className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                                Converts <span className="font-medium">{item.item_name}</span> (parent) into
                                retail units of a child item. Decrements this SKU and increments the child.
                            </p>

                            <ItemSearchInput
                                orgSlug={orgSlug}
                                value={bdChildName}
                                label="Child item *"
                                placeholder="Search child item..."
                                onSelect={(found) => {
                                    setBdChildSku(found.sku);
                                    setBdChildName(found.name);
                                }}
                            />

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium">Parent quantity *</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        min="0"
                                        step="any"
                                        value={bdParentQty}
                                        onChange={(e) => setBdParentQty(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium">Units per parent *</label>
                                    <Input
                                        type="number"
                                        placeholder="e.g. 24"
                                        min="0"
                                        step="any"
                                        value={bdConversion}
                                        onChange={(e) => setBdConversion(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {parseFloat(bdParentQty) > 0 && parseFloat(bdConversion) > 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Produces{' '}
                                    <span className="font-semibold text-foreground tabular-nums">
                                        {(parseFloat(bdParentQty) * parseFloat(bdConversion)).toLocaleString()}
                                    </span>{' '}
                                    child unit(s).
                                </p>
                            )}

                            <textarea
                                placeholder="Notes (optional)..."
                                value={bdNotes}
                                onChange={(e) => setBdNotes(e.target.value)}
                                rows={2}
                                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                            />

                            <Button type="submit" className="w-full" size="sm" disabled={createBreakdown.isPending}>
                                {createBreakdown.isPending ? 'Processing...' : 'Break Down Stock'}
                            </Button>
                        </form>
                    )}
                </div>
                </SubscriptionGate>
                )}

                {/* Recent adjustments */}
                {(itemAdj?.length ?? 0) > 0 && (
                    <div className="border-t border-border pt-4">
                        <h3 className="text-sm font-semibold mb-2">Recent Adjustments</h3>
                        <div className="space-y-1.5">
                            {itemAdj?.map((adj) => (
                                <div key={adj.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-muted/30">
                                    <span className="text-muted-foreground">{new Date(adj.adjusted_at ?? adj.created_at).toLocaleDateString()}</span>
                                    <span className="text-muted-foreground capitalize">{adj.reason}</span>
                                    <span className={`font-semibold tabular-nums ${adj.quantity_change > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                                        {adj.quantity_change > 0 ? '+' : ''}{adj.quantity_change}
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
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [categoryId, setCategoryId] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [page, setPage] = useState(1);
    const [selectedItem, setSelectedItem] = useState<StockLevel | null>(null);
    const [drawerAction, setDrawerAction] = useState<'adjust' | 'breakdown' | undefined>(undefined);

    function openItem(item: StockLevel, action?: 'adjust' | 'breakdown') {
        setSelectedItem(item);
        setDrawerAction(action);
    }

    const { canAny } = usePermissions();
    const canAdjust = canAny([P.STOCK_CHANGE, P.STOCK_MANAGE]);

    const { data: categories } = useCategories(orgSlug);

    // Search, category and type are filtered server-side; the low/out status filter is
    // applied client-side so the banner counts stay accurate within the current scope.
    const listParams: StockListParams = {
        search: search || undefined,
        category_id: categoryId || undefined,
        type: typeFilter || undefined,
    };
    const { data: stock, isLoading, isError, refetch } = useStock(orgSlug, listParams);

    const lowStockCount = stock?.filter((s) => s.reorder_point != null && s.available <= s.reorder_point && s.available > 0).length ?? 0;
    const outOfStockCount = stock?.filter((s) => s.available <= 0).length ?? 0;

    const filteredStock = useMemo(() => {
        const list = stock ?? [];
        if (statusFilter === 'low') {
            return list.filter((s) => s.reorder_point != null && s.available > 0 && s.available <= s.reorder_point);
        }
        if (statusFilter === 'out') {
            return list.filter((s) => s.available <= 0);
        }
        return list;
    }, [stock, statusFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredStock.length / ITEMS_PER_PAGE));
    const paginatedItems = filteredStock.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

    useMemo(() => { setPage(1); }, [search, statusFilter, categoryId, typeFilter]);

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Stock Levels</h1>
                <p className="text-muted-foreground mt-1">Real-time stock availability across all warehouses</p>
            </div>

            {(lowStockCount > 0 || outOfStockCount > 0) && (
                <div className="flex flex-wrap gap-3">
                    {outOfStockCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter((p) => (p === 'out' ? 'all' : 'out'))}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/20 ${statusFilter === 'out' ? 'border-red-500 ring-1 ring-red-500/40' : 'border-red-500/20'}`}
                        >
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span className="text-sm font-medium">{outOfStockCount} item{outOfStockCount > 1 ? 's' : ''} out of stock</span>
                        </button>
                    )}
                    {lowStockCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setStatusFilter((p) => (p === 'low' ? 'all' : 'low'))}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl bg-yellow-500/10 border text-yellow-600 dark:text-yellow-400 transition-colors hover:bg-yellow-500/20 ${statusFilter === 'low' ? 'border-yellow-500 ring-1 ring-yellow-500/40' : 'border-yellow-500/20'}`}
                        >
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span className="text-sm font-medium">{lowStockCount} item{lowStockCount > 1 ? 's' : ''} below reorder point</span>
                        </button>
                    )}
                </div>
            )}

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by item name, SKU, or warehouse..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10"
                            />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                                className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                            >
                                <option value="all">All status</option>
                                <option value="low">Low stock</option>
                                <option value="out">Out of stock</option>
                            </select>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                            >
                                <option value="">All categories</option>
                                {categories?.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                            >
                                <option value="">All types</option>
                                {STOCKABLE_TYPES.map((t) => (
                                    <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                                ))}
                            </select>
                        </div>
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
                                ) : isError ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center">
                                            <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                                            <p className="text-muted-foreground">Couldn&apos;t load stock levels</p>
                                            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                        </td>
                                    </tr>
                                ) : filteredStock.length === 0 ? (
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
                                                onClick={() => openItem(item)}
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
                                                    {canAdjust && (
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                title="Record Adjustment"
                                                                aria-label="Record adjustment"
                                                                onClick={() => openItem(item, 'adjust')}
                                                            >
                                                                <SlidersHorizontal className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                title="Break Down Stock"
                                                                aria-label="Break down stock"
                                                                onClick={() => openItem(item, 'breakdown')}
                                                            >
                                                                <Split className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && filteredStock.length > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>

            {selectedItem && (
                <StockDrawer
                    key={`${selectedItem.id}-${drawerAction ?? 'view'}`}
                    item={selectedItem}
                    orgSlug={orgSlug}
                    onClose={() => { setSelectedItem(null); setDrawerAction(undefined); }}
                    canAdjust={canAdjust}
                    initialAction={drawerAction}
                />
            )}
        </div>
    );
}
