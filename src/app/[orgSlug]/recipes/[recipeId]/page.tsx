'use client';

import { Button, Card, CardContent, CardHeader } from '@/components/ui/base';
import { fetchRecipe } from '@/lib/api/recipes';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ChefHat, Package } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function RecipeDetailPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const recipeId = params?.recipeId as string;

    const { data: recipe, isLoading, isError } = useQuery({
        queryKey: ['recipe', orgSlug, recipeId],
        queryFn: () => fetchRecipe(orgSlug, recipeId),
        enabled: !!orgSlug && !!recipeId,
    });

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center gap-4">
                <Link href={`/${orgSlug}/recipes`}>
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Recipes
                    </Button>
                </Link>
                <div className="flex items-center gap-2">
                    <ChefHat className="h-5 w-5 text-primary" />
                    <h1 className="text-2xl font-bold tracking-tight">
                        {recipe?.name ?? (isLoading ? 'Loading...' : 'Recipe Detail')}
                    </h1>
                </div>
            </div>

            {isLoading && (
                <div className="flex items-center justify-center min-h-[300px]">
                    <div className="animate-pulse text-muted-foreground">Loading recipe...</div>
                </div>
            )}

            {!isLoading && (isError || !recipe) && (
                <Card>
                    <CardContent className="py-16 text-center">
                        <ChefHat className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
                        <p className="text-lg font-medium text-muted-foreground">Recipe not found</p>
                        <Link href={`/${orgSlug}/recipes`} className="mt-4 inline-block">
                            <Button variant="outline" size="sm">Back to Recipes</Button>
                        </Link>
                    </CardContent>
                </Card>
            )}

            {!isLoading && recipe && (
                <>
                    {recipe.description && (
                        <p className="text-muted-foreground">{recipe.description}</p>
                    )}

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

                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Package className="h-5 w-5 text-primary" />
                                <h2 className="text-lg font-semibold">Ingredients</h2>
                                <span className="ml-auto text-sm text-muted-foreground">
                                    {recipe.ingredients?.length ?? 0} ingredient{(recipe.ingredients?.length ?? 0) !== 1 ? 's' : ''}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-border bg-muted/30">
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Ingredient</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground">Quantity</th>
                                            <th className="text-left px-6 py-3 font-medium text-muted-foreground">Unit</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Waste %</th>
                                            <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Cost</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border">
                                        {(recipe.ingredients?.length ?? 0) === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                                                    No ingredients defined for this recipe
                                                </td>
                                            </tr>
                                        ) : (
                                            recipe.ingredients.map((ing) => (
                                                <tr key={ing.id ?? ing.item_id} className="hover:bg-accent/30 transition-colors">
                                                    <td className="px-6 py-4 font-medium">{ing.item_name ?? ing.item_id}</td>
                                                    <td className="px-6 py-4 text-right tabular-nums font-semibold">{ing.quantity}</td>
                                                    <td className="px-6 py-4 text-muted-foreground">{ing.unit_name ?? ing.unit_id}</td>
                                                    <td className="px-6 py-4 text-right tabular-nums text-muted-foreground hidden sm:table-cell">
                                                        {ing.waste_percent}%
                                                    </td>
                                                    <td className="px-6 py-4 text-right tabular-nums hidden md:table-cell">
                                                        {ing.cost != null ? ing.cost.toLocaleString() : '—'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
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
