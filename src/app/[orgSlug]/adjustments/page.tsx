'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { apiClient } from '@/lib/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

interface AdjustmentPayload {
    itemId: string;
    type: 'add' | 'remove';
    quantity: number;
    reason: string;
    warehouseId?: string;
}

export default function AdjustmentsPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const queryClient = useQueryClient();

    const [type, setType] = useState<'add' | 'remove'>('add');
    const [itemId, setItemId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [warehouseId, setWarehouseId] = useState('');

    const mutation = useMutation({
        mutationFn: (payload: AdjustmentPayload) =>
            apiClient.post(`/api/v1/tenants/${orgSlug}/inventory/adjustments`, payload),
        onSuccess: () => {
            toast.success('Stock adjustment recorded successfully');
            queryClient.invalidateQueries({ queryKey: ['catalog'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            setItemId('');
            setQuantity('');
            setReason('');
            setWarehouseId('');
        },
        onError: () => {
            toast.error('Failed to record adjustment');
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const qty = parseInt(quantity, 10);
        if (!itemId || isNaN(qty) || qty <= 0 || !reason) {
            toast.error('Please fill in all required fields');
            return;
        }

        mutation.mutate({
            itemId,
            type,
            quantity: qty,
            reason,
            warehouseId: warehouseId || undefined,
        });
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Stock Adjustments</h1>
                <p className="text-muted-foreground mt-1">Add or remove stock manually</p>
            </div>

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

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Item ID / SKU *</label>
                            <Input
                                placeholder="e.g. ITM-001 or SKU-FLOUR-50KG"
                                value={itemId}
                                onChange={(e) => setItemId(e.target.value)}
                                required
                            />
                        </div>

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
                                <Input
                                    placeholder="Warehouse ID (optional)"
                                    value={warehouseId}
                                    onChange={(e) => setWarehouseId(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">Reason *</label>
                            <textarea
                                placeholder="Describe the reason for this adjustment..."
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required
                                rows={3}
                                className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                            />
                        </div>

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
        </div>
    );
}
