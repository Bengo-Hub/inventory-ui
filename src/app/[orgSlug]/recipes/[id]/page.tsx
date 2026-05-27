'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { useRecipe, useUpdateRecipe } from '@/hooks/use-recipes';
import { useUnits } from '@/hooks/useUnits';
import type { RecipeIngredient } from '@/lib/api/recipes';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

type IngredientRow = {
    item_id: string;
    item_name: string;
    quantity: string;
    unit_id: string;
    waste_percent: string;
};

function emptyRow(): IngredientRow {
    return { item_id: '', item_name: '', quantity: '', unit_id: '', waste_percent: '0' };
}

export default function RecipeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;
    const recipeId = params?.id as string;

    const { data: recipe, isLoading } = useRecipe(orgSlug, recipeId);
    const { data: units } = useUnits(orgSlug);
    const updateRecipe = useUpdateRecipe(orgSlug);

    const [rows, setRows] = useState<IngredientRow[]>([]);
    const [initialized, setInitialized] = useState(false);

    useEffect(() => {
        if (recipe && !initialized) {
            setRows(
                (recipe.ingredients ?? []).map((ing: RecipeIngredient) => ({
                    item_id: ing.item_id,
                    item_name: ing.item_name ?? '',
                    quantity: String(ing.quantity),
                    unit_id: ing.unit_id,
                    waste_percent: String(ing.waste_percent ?? 0),
                }))
            );
            setInitialized(true);
        }
    }, [recipe, initialized]);

    function addRow() {
        setRows((prev) => [...prev, emptyRow()]);
    }

    function removeRow(idx: number) {
        setRows((prev) => prev.filter((_, i) => i !== idx));
    }

    function updateRow(idx: number, field: keyof IngredientRow, value: string) {
        setRows((prev) => {
            const updated = [...prev];
            updated[idx] = { ...updated[idx], [field]: value };
            return updated;
        });
    }

    function handleSave() {
        if (!recipe) return;

        const validIngredients = rows
            .filter((r) => r.item_id && r.quantity && Number(r.quantity) > 0)
            .map((r) => ({
                item_id: r.item_id,
                quantity: Number(r.quantity),
                unit_id: r.unit_id,
                waste_percent: Number(r.waste_percent) || 0,
            }));

        updateRecipe.mutate({
            id: recipe.id,
            data: {
                name: recipe.name,
                description: recipe.description,
                itemId: recipe.itemId,
                target_margin_percent: recipe.target_margin_percent,
                servings: recipe.servings,
                ingredients: validIngredients,
            },
        }, {
            onSuccess: () => toast.success('Recipe ingredients saved'),
            onError: () => toast.error('Failed to save ingredients'),
        });
    }

    function formatCurrency(value: number) {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(value);
    }

    if (isLoading) {
        return (
            <div className="p-6">
                <p className="text-muted-foreground">Loading recipe...</p>
            </div>
        );
    }

    if (!recipe) {
        return (
            <div className="p-6">
                <p className="text-muted-foreground">Recipe not found.</p>
                <Button variant="ghost" size="sm" onClick={() => router.back()} className="mt-2">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{recipe.name}</h1>
                    {recipe.description && <p className="text-muted-foreground text-sm">{recipe.description}</p>}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold">Ingredients</h2>
                            <Button type="button" variant="ghost" size="sm" onClick={addRow}>
                                <Plus className="h-4 w-4 mr-1" />
                                Add Ingredient
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {rows.length === 0 && (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                    No ingredients yet. Click &quot;Add Ingredient&quot; to start.
                                </p>
                            )}
                            {rows.map((row, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr_80px_120px_80px_36px] gap-2 items-end">
                                    <ItemSearchInput
                                        orgSlug={orgSlug}
                                        value={row.item_name}
                                        placeholder="Search ingredient..."
                                        onSelect={(item) => {
                                            updateRow(idx, 'item_id', item.id);
                                            updateRow(idx, 'item_name', item.name);
                                        }}
                                    />
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Qty</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            step="0.001"
                                            placeholder="0"
                                            value={row.quantity}
                                            onChange={(e) => updateRow(idx, 'quantity', e.target.value)}
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Unit</label>
                                        <select
                                            value={row.unit_id}
                                            onChange={(e) => updateRow(idx, 'unit_id', e.target.value)}
                                            className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                        >
                                            <option value="">—</option>
                                            {units?.map((u) => (
                                                <option key={u.id} value={u.id}>{u.abbreviation}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-muted-foreground">Waste %</label>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="100"
                                            placeholder="0"
                                            value={row.waste_percent}
                                            onChange={(e) => updateRow(idx, 'waste_percent', e.target.value)}
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeRow(idx)}
                                        className="p-2 rounded hover:bg-destructive/10 text-destructive mb-0.5"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="mt-4 pt-4 border-t border-border">
                            <Button onClick={handleSave} disabled={updateRecipe.isPending} className="w-full">
                                {updateRecipe.isPending ? 'Saving...' : 'Save Ingredients'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <h2 className="text-lg font-semibold">Cost Summary</h2>
                    </CardHeader>
                    <CardContent>
                        <dl className="space-y-4 text-sm">
                            <div>
                                <dt className="text-muted-foreground">Produces</dt>
                                <dd className="font-medium mt-1">{recipe.itemName || '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">Servings</dt>
                                <dd className="font-medium mt-1">{recipe.servings}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">Total Cost</dt>
                                <dd className="font-medium mt-1">{formatCurrency(recipe.total_cost)}</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">Cost Per Portion</dt>
                                <dd className="font-semibold mt-1 text-lg">{formatCurrency(recipe.cost_per_portion)}</dd>
                            </div>
                            <div className="pt-2 border-t border-border">
                                <dt className="text-muted-foreground">Target Margin</dt>
                                <dd className="font-medium mt-1">{recipe.target_margin_percent}%</dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">Suggested Price</dt>
                                <dd className="font-bold text-lg text-emerald-600 dark:text-emerald-400 mt-1">
                                    {formatCurrency(recipe.suggested_price)}
                                </dd>
                            </div>
                        </dl>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
