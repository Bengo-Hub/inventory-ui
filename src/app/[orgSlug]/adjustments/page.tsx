'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { useCreateAdjustment, useAdjustments } from '@/hooks/useStock';
import { useWarehouses } from '@/hooks/useWarehouses';
import { ClipboardList, Minus, Plus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

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

type Tab = 'new' | 'history';

export default function AdjustmentsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [tab, setTab] = useState<Tab>('new');

    const [type, setType] = useState<'add' | 'remove'>('add');
    const [itemSku, setItemSku] = useState('');
    const [itemName, setItemName] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [warehouseId, setWarehouseId] = useState('');

    const { data: warehouses } = useWarehouses(orgSlug);
    const { data: adjustments, isLoading: adjLoading } = useAdjustments(orgSlug);
    const mutation = useCreateAdjustment(orgSlug);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const qty = parseInt(quantity, 10);
        if (!itemSku || isNaN(qty) || qty <= 0 || !reason) {
            toast.error('Please fill in all required fields');
            return;
        }

        const reasonText = reason === 'other'
            ? `other: ${notes.trim()}`
            : REASON_OPTIONS.find((r) => r.value === reason)?.label ?? reason;

        mutation.mutate({
            sku: itemSku,
            adjustment: type === 'add' ? qty : -qty,
            reason: reasonText,
            notes: notes.trim() || undefined,
            warehouse_id: warehouseId || undefined,
        }, {
            onSuccess: () => {
                toast.success('Stock adjustment recorded successfully');
                setItemSku('');
                setItemName('');
                setQuantity('');
                setReason('');
                setNotes('');
                setWarehouseId('');
            },
            onError: () => {
                toast.error('Failed to record adjustment');
            },
        });
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Stock Adjustments</h1>
                <p className="text-muted-foreground mt-1">Add or remove stock manually</p>
            </div>

            <div className="flex gap-1 border-b border-border">
                <button
                    className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'new' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setTab('new')}
                >
                    New Adjustment
                </button>
                <button
                    className={`px-4 py-2 text-sm font-medium transition-colors ${tab === 'history' ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                    onClick={() => setTab('history')}
                >
                    History
                </button>
            </div>

            {tab === 'new' ? (
                <Card className="max-w-2xl">
                    <CardHeader>
                        <h2 className="text-lg font-semibold">New Adjustment</h2>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant={type === 'add' ? 'primary' : 'outline'}
                                    onClick={() => setType('add')}
                                    className="flex-1"
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Stock
                                </Button>
                                <Button
                                    type="button"
                                    variant={type === 'remove' ? 'destructive' : 'outline'}
                                    onClick={() => setType('remove')}
                                    className="flex-1"
                                >
                                    <Minus className="h-4 w-4 mr-2" />
                                    Remove Stock
                                </Button>
                            </div>

                            <ItemSearchInput
                                orgSlug={orgSlug}
                                value={itemName}
                                label="Item *"
                                placeholder="Search by name or SKU..."
                                onSelect={(item) => {
                                    setItemSku(item.sku);
                                    setItemName(item.name);
                                }}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Quantity *</label>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        min="1"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Warehouse</label>
                                    <select
                                        value={warehouseId}
                                        onChange={(e) => setWarehouseId(e.target.value)}
                                        className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                    >
                                        <option value="">All Warehouses</option>
                                        {warehouses?.map((wh) => (
                                            <option key={wh.id} value={wh.id}>{wh.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium">Reason *</label>
                                <select
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    required
                                    className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                >
                                    <option value="">Select reason...</option>
                                    {REASON_OPTIONS.map((r) => (
                                        <option key={r.value} value={r.value}>{r.label}</option>
                                    ))}
                                </select>
                            </div>

                            {reason === 'other' && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Notes *</label>
                                    <textarea
                                        placeholder="Describe the reason for this adjustment..."
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        required
                                        rows={3}
                                        className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                                    />
                                </div>
                            )}

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={mutation.isPending}
                            >
                                {mutation.isPending ? 'Recording...' : `Record ${type === 'add' ? 'Addition' : 'Removal'}`}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-border bg-muted/30">
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Date</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground">Item</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Warehouse</th>
                                        <th className="text-right px-6 py-3 font-medium text-muted-foreground">Qty</th>
                                        <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Reason</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {adjLoading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">Loading history...</td>
                                        </tr>
                                    ) : (adjustments?.length ?? 0) === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center">
                                                <ClipboardList className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                                <p className="text-muted-foreground">No adjustments recorded yet</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        adjustments?.map((adj) => (
                                            <tr key={adj.id} className="hover:bg-accent/30 transition-colors">
                                                <td className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                                                    {new Date(adj.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="font-medium">{adj.itemName || '—'}</div>
                                                </td>
                                                <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">
                                                    {adj.warehouseName || '—'}
                                                </td>
                                                <td className={`px-6 py-4 text-right tabular-nums font-semibold ${adj.quantity > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
                                                    {adj.quantity > 0 ? '+' : ''}{adj.quantity}
                                                </td>
                                                <td className="px-6 py-4 text-muted-foreground hidden sm:table-cell capitalize">
                                                    {adj.reason}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
