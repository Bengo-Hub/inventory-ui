'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { type CreateBatchInput } from '@/lib/api/productionBatches';
import { X } from 'lucide-react';
import { useState } from 'react';

interface Props {
    isPending: boolean;
    onSubmit: (data: CreateBatchInput) => void;
    onClose: () => void;
}

export function BatchFormDialog({ isPending, onSubmit, onClose }: Props) {
    const [recipeId, setRecipeId] = useState('');
    const [plannedQuantity, setPlannedQuantity] = useState('1');
    const [scheduledDate, setScheduledDate] = useState('');
    const [laborCost, setLaborCost] = useState('');
    const [overheadCost, setOverheadCost] = useState('');
    const [notes, setNotes] = useState('');

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!recipeId.trim()) return;
        onSubmit({
            recipe_id: recipeId.trim(),
            planned_quantity: Number(plannedQuantity) || 1,
            scheduled_date: scheduledDate ? new Date(scheduledDate).toISOString() : undefined,
            labor_cost: laborCost ? Number(laborCost) : undefined,
            overhead_cost: overheadCost ? Number(overheadCost) : undefined,
            notes: notes.trim() || undefined,
        });
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold">New Production Batch</h2>
                        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                    </div>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <label className="space-y-1 block">
                            <span className="text-sm font-medium">Recipe ID *</span>
                            <Input value={recipeId} onChange={(e) => setRecipeId(e.target.value)} placeholder="Recipe UUID" required />
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Planned Quantity *</span>
                                <Input type="number" min="1" value={plannedQuantity} onChange={(e) => setPlannedQuantity(e.target.value)} required />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Scheduled Date</span>
                                <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Labor Cost</span>
                                <Input type="number" step="0.01" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} placeholder="0.00" />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-sm font-medium">Overhead Cost</span>
                                <Input type="number" step="0.01" value={overheadCost} onChange={(e) => setOverheadCost(e.target.value)} placeholder="0.00" />
                            </label>
                        </div>
                        <label className="space-y-1 block">
                            <span className="text-sm font-medium">Notes</span>
                            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes" />
                        </label>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                            <Button type="submit" disabled={isPending}>{isPending ? 'Creating…' : 'Create Batch'}</Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
