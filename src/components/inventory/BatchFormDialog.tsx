'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { useMaterialCheck } from '@/hooks/useProductionBatches';
import { useRecipes } from '@/hooks/use-recipes';
import { type CreateBatchInput } from '@/lib/api/productionBatches';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useState } from 'react';

interface Props {
    isPending: boolean;
    onSubmit: (data: CreateBatchInput) => void;
    onClose: () => void;
}

const selectClass = 'w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none';

export function BatchFormDialog({ isPending, onSubmit, onClose }: Props) {
    const params = useParams();
    const org = params?.orgSlug as string;

    const [recipeId, setRecipeId] = useState('');
    const [plannedQuantity, setPlannedQuantity] = useState('1');
    const [scheduledDate, setScheduledDate] = useState('');
    const [laborCost, setLaborCost] = useState('');
    const [overheadCost, setOverheadCost] = useState('');
    const [notes, setNotes] = useState('');

    const { data: recipesPage } = useRecipes(org, { limit: 200 });
    const recipes = recipesPage?.data ?? [];
    const qtyNum = Number(plannedQuantity) || 0;
    // Live material-availability preview for the chosen recipe + quantity.
    const { data: check } = useMaterialCheck(org, recipeId, qtyNum);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!recipeId) return;
        onSubmit({
            recipe_id: recipeId,
            planned_quantity: qtyNum || 1,
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
                            <span className="text-sm font-medium">Recipe / Formula *</span>
                            <select className={selectClass} value={recipeId} onChange={(e) => setRecipeId(e.target.value)} required>
                                <option value="">— Select a recipe —</option>
                                {recipes.map((rc) => <option key={rc.id} value={rc.id}>{rc.name} ({rc.sku})</option>)}
                            </select>
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

                        {/* Material availability preview */}
                        {recipeId && qtyNum > 0 && check && (
                            check.ok ? (
                                <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600">
                                    <CheckCircle2 className="h-4 w-4" /> All raw materials are in stock for this batch.
                                </div>
                            ) : (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm">
                                    <div className="flex items-center gap-2 text-amber-600 font-medium"><AlertTriangle className="h-4 w-4" /> Insufficient raw materials</div>
                                    <ul className="mt-1 ml-6 list-disc text-muted-foreground">
                                        {check.shortages.map((s) => (
                                            <li key={s.item_id}>{s.item_sku || s.item_id.slice(0, 8)}: need {s.required}, have {s.available}</li>
                                        ))}
                                    </ul>
                                    <p className="mt-1 text-xs text-muted-foreground">You can still create the batch; starting it will require enough stock (or force-start).</p>
                                </div>
                            )
                        )}

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
