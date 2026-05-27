'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { useRecipes, useCreateRecipe, useUpdateRecipe, useDeleteRecipe } from '@/hooks/use-recipes';
import type { Recipe, RecipePayload } from '@/lib/api/recipes';
import { ChefHat, FlaskConical, Plus, Search, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

export default function RecipesPage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Recipe | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formItemId, setFormItemId] = useState('');
    const [formItemName, setFormItemName] = useState('');
    const [formServings, setFormServings] = useState('1');
    const [formMargin, setFormMargin] = useState('30');

    const { data: recipes, isLoading } = useRecipes(orgSlug, search ? { search } : undefined);
    const createMutation = useCreateRecipe(orgSlug);
    const updateMutation = useUpdateRecipe(orgSlug);
    const deleteMutation = useDeleteRecipe(orgSlug);

    const mutation = editing ? updateMutation : createMutation;

    const totalPages = Math.max(1, Math.ceil((recipes?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = recipes?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    useMemo(() => { setPage(1); }, [search]);

    function openCreate() {
        setEditing(null);
        setFormName('');
        setFormDescription('');
        setFormItemId('');
        setFormItemName('');
        setFormServings('1');
        setFormMargin('30');
        setDialogOpen(true);
    }

    function openEdit(recipe: Recipe) {
        setEditing(recipe);
        setFormName(recipe.name);
        setFormDescription(recipe.description);
        setFormItemId(recipe.itemId);
        setFormItemName(recipe.itemName ?? '');
        setFormServings(String(recipe.servings));
        setFormMargin(String(recipe.target_margin_percent));
        setDialogOpen(true);
    }

    function closeDialog() {
        setDialogOpen(false);
        setEditing(null);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formName.trim()) {
            toast.error('Recipe name is required');
            return;
        }
        const payload: RecipePayload = {
            name: formName.trim(),
            description: formDescription.trim(),
            itemId: formItemId.trim(),
            servings: Number(formServings) || 1,
            target_margin_percent: Number(formMargin) || 0,
            ingredients: editing?.ingredients?.map((ing) => ({
                item_id: ing.item_id,
                quantity: ing.quantity,
                unit_id: ing.unit_id,
                waste_percent: ing.waste_percent,
            })) ?? [],
        };

        if (editing) {
            updateMutation.mutate(
                { id: editing.id, data: payload },
                {
                    onSuccess: () => { toast.success('Recipe updated'); closeDialog(); },
                    onError: () => { toast.error('Failed to update recipe'); },
                },
            );
        } else {
            createMutation.mutate(payload, {
                onSuccess: () => { toast.success('Recipe created'); closeDialog(); },
                onError: () => { toast.error('Failed to create recipe'); },
            });
        }
    }

    function handleDelete(recipe: Recipe) {
        if (!confirm(`Delete recipe "${recipe.name}"?`)) return;
        deleteMutation.mutate(recipe.id, {
            onSuccess: () => toast.success('Recipe deleted'),
            onError: () => toast.error('Failed to delete recipe'),
        });
    }

    function formatCurrency(value: number) {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(value);
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Recipes / BOM</h1>
                    <p className="text-muted-foreground mt-1">Manage recipes and bills of materials</p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Recipe
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search recipes..."
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
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Produces</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Ingredients</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Cost/Portion</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Suggested Price</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading recipes...
                                        </td>
                                    </tr>
                                ) : (recipes?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <ChefHat className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No recipes found</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((recipe) => (
                                        <tr key={recipe.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-4 font-medium">{recipe.name}</td>
                                            <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">
                                                {recipe.itemName || recipe.itemId || '-'}
                                            </td>
                                            <td className="px-6 py-4 text-right tabular-nums hidden sm:table-cell">
                                                <Badge variant="outline">
                                                    {recipe.ingredients?.length ?? 0}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right tabular-nums hidden lg:table-cell">
                                                {formatCurrency(recipe.cost_per_portion)}
                                            </td>
                                            <td className="px-6 py-4 text-right tabular-nums hidden lg:table-cell">
                                                {formatCurrency(recipe.suggested_price)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Manage ingredients"
                                                        onClick={() => router.push(`/${orgSlug}/recipes/${recipe.id}`)}
                                                    >
                                                        <FlaskConical className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => openEdit(recipe)}>
                                                        Edit
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleDelete(recipe)}>
                                                        <Trash2 className="h-4 w-4 text-destructive" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (recipes?.length ?? 0) > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
                </CardContent>
            </Card>

            {/* Add/Edit Recipe Dialog */}
            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
                    <div className="relative z-50 w-full max-w-lg mx-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">
                                        {editing ? 'Edit Recipe' : 'Add Recipe'}
                                    </h2>
                                    <button onClick={closeDialog} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Recipe Name *</label>
                                        <Input
                                            placeholder="e.g. Margherita Pizza"
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Description</label>
                                        <Input
                                            placeholder="Brief description"
                                            value={formDescription}
                                            onChange={(e) => setFormDescription(e.target.value)}
                                        />
                                    </div>
                                    <ItemSearchInput
                                        orgSlug={orgSlug}
                                        value={formItemName}
                                        label="Produced Item"
                                        placeholder="Search for produced item..."
                                        onSelect={(item) => {
                                            setFormItemId(item.id);
                                            setFormItemName(item.name);
                                        }}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Servings</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                value={formServings}
                                                onChange={(e) => setFormServings(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Target Margin %</label>
                                            <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={formMargin}
                                                onChange={(e) => setFormMargin(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Ingredients can be managed after creating the recipe.
                                    </p>
                                    <div className="flex gap-3 pt-2">
                                        <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" className="flex-1" disabled={mutation.isPending}>
                                            {mutation.isPending ? 'Saving...' : editing ? 'Update' : 'Create'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
}
