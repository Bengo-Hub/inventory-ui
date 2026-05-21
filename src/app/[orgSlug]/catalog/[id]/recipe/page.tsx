'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { apiClient } from '@/lib/api/client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChefHat, Package } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface RecipeIngredient {
    id: string;
    item_id: string;
    item_name: string;
    sku?: string;
    quantity: number;
    unit_name: string;
    waste_percent: number;
    cost?: number;
}

interface RecipeDetail {
    id: string;
    name: string;
    description?: string;
    servings: number;
    total_cost: number;
    cost_per_portion: number;
    suggested_price: number;
    target_margin_percent: number;
    ingredients: RecipeIngredient[];
}

export default function ItemRecipePage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const id = params?.id as string;

    const { data: recipe, isLoading, isError } = useQuery<RecipeDetail>({
        queryKey: ['item-recipe', orgSlug, id],
        queryFn: () => apiClient.get(`/api/v1/${orgSlug}/inventory/items/${id}/recipe`),
        enabled: !!orgSlug && !!id,
    });

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Link href={`/${orgSlug}/catalog/${id}`}>
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Item
                    </Button>
                </Link>
                <div className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-primary" />
                    <h1 className="text-2xl font-bold tracking-tight">Recipe / BOM</h1>
                </div>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center min-h-[300px]">
                    <div className="animate-pulse text-muted-foreground">Loading recipe...</div>
                </div>
            )}

            {!isLoading && (isError || !recipe || !recipe.ingredients || recipe.ingredients.length === 0) && (
                <Card>
                    <CardContent className="py-16 text-center">
                        <ChefHat className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                        <p className="text-lg font-medium text-muted-foreground">No recipe defined</p>
                        <p className="text-sm text-muted-foreground/70 mt-1">
                            This item does not have a Bill of Materials or recipe configured.
                        </p>
                        <Link href={`/${orgSlug}/recipes`} className="mt-4 inline-block">
                            <Button variant="outline" size="sm">Manage Recipes</Button>
                        </Link>
                    </CardContent>
                </Card>
            )}

            {!isLoading && recipe && recipe.ingredients && recipe.ingredients.length > 0 && (
                <>
                    {/* Recipe summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Servings', value: recipe.servings },
                            { label: 'Total Cost', value: recipe.total_cost.toLocaleString() },
                            { label: 'Cost / Portion', value: recipe.cost_per_portion.toLocaleString() },
                            { label: 'Suggested Price', value: recipe.suggested_price.toLocaleString() },
                        ].map(({ label, value }) => (
                            <Card key={label}>
                                <CardContent className="p-4">
                                    <p className="text-xs text-muted-foreground">{label}</p>
                                    <p className="text-lg font-bold mt-1">{value}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Ingredients table */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-primary" />
                                <h2 className="text-lg font-semibold">Ingredients</h2>
                                <span className="ml-auto text-sm text-muted-foreground">
                                    {recipe.ingredients.length} ingredient{recipe.ingredients.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/30">
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Quantity</th>
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Unit</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Waste %</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {recipe.ingredients.map((ing) => (
                                            <tr key={ing.id ?? ing.item_id} className="hover:bg-accent/30 transition-colors">
                                                <td className="px-6 py-4 font-medium">{ing.item_name}</td>
                                                <td className="px-6 py-4 text-right tabular-nums font-semibold">{ing.quantity}</td>
                                                <td className="px-6 py-4 text-muted-foreground">{ing.unit_name}</td>
                                                <td className="px-6 py-4 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                                                    {ing.waste_percent}%
                                                </td>
                                                <td className="px-6 py-4 text-right tabular-nums hidden md:table-cell">
                                                    {ing.cost != null ? ing.cost.toLocaleString() : '—'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
