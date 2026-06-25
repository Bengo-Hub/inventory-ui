'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Pagination } from '@/components/ui/pagination';
import { ItemSearchInput } from '@/components/inventory/ItemSearchInput';
import { useRecipes, useCreateRecipe, useUpdateRecipe, useDeleteRecipe } from '@/hooks/use-recipes';
import type { Recipe, RecipePayload } from '@/lib/api/recipes';
import { useOutletStore } from '@/store/outlet';
import { AlertTriangle, ChefHat, Factory, FlaskConical, Plus, Search, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';

const ITEMS_PER_PAGE = 20;

function generateSKU(name: string): string {
    const slug = name.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `RCP-${slug}-${Date.now().toString(36).toUpperCase()}`;
}

function formatCurrency(value?: number | null): string {
    if (value == null || isNaN(value)) return '—';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'KES' }).format(value);
}

export default function RecipesPage() {
    const params = useParams();
    const router = useRouter();
    const orgSlug = params?.orgSlug as string;
    const { outlet } = useOutletStore();
    const isMfg = outlet?.use_case === 'manufacturing';
    const docLabel = isMfg ? 'Bill of Materials' : 'Recipe';

    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Recipe | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);

    // Form state
    const [formName, setFormName] = useState('');
    const [formSKU, setFormSKU] = useState('');
    const [formItemId, setFormItemId] = useState('');
    const [formItemName, setFormItemName] = useState('');
    const [formServings, setFormServings] = useState('1');
    const [formMargin, setFormMargin] = useState('30');
    const [formRequiresQC, setFormRequiresQC] = useState(true);

    const { data, isLoading, isError, refetch } = useRecipes(orgSlug, { search: search || undefined, page, limit: ITEMS_PER_PAGE });
    const createMutation = useCreateRecipe(orgSlug);
    const updateMutation = useUpdateRecipe(orgSlug);
    const deleteMutation = useDeleteRecipe(orgSlug);

    const mutation = editing ? updateMutation : createMutation;

    const paginatedItems = data?.data ?? [];
    const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / ITEMS_PER_PAGE));

    useMemo(() => { setPage(1); }, [search]);

    function openCreate() {
        setEditing(null);
        setFormName('');
        setFormSKU('');
        setFormItemId('');
        setFormItemName('');
        setFormServings('1');
        setFormMargin('30');
        setFormRequiresQC(true);
        setDialogOpen(true);
    }

    function openEdit(recipe: Recipe) {
        setEditing(recipe);
        setFormName(recipe.name);
        setFormSKU(recipe.sku);
        setFormItemId(recipe.item_id ?? '');
        setFormItemName(recipe.item_name ?? '');
        setFormServings(String(recipe.output_qty ?? 1));
        setFormMargin(String(recipe.target_margin_percent ?? 30));
        setFormRequiresQC(recipe.requires_qc ?? true);
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
        const sku = formSKU.trim() || generateSKU(formName.trim());
        const kind: 'menu' | 'bom' = editing?.kind ?? (isMfg ? 'bom' : 'menu');
        const payload: RecipePayload = {
            sku,
            name: formName.trim(),
            item_id: formItemId.trim() || undefined,
            output_qty: Number(formServings) || 1,
            unit_of_measure: kind === 'bom' ? 'UNIT' : 'PORTION',
            is_active: true,
            kind,
            requires_qc: kind === 'bom' ? formRequiresQC : undefined,
            target_margin_percent: kind === 'bom' ? null : (Number(formMargin) || null),
            ingredients: editing?.ingredients?.map((ing) => ({
                item_id: ing.item_id,
                item_sku: ing.item_sku,
                quantity: ing.quantity,
                unit_id: ing.unit_id,
                unit_of_measure: ing.unit_of_measure ?? '',
                waste_percent: ing.waste_percent,
                notes: ing.notes,
            })) ?? [],
        };

        if (editing) {
            updateMutation.mutate(
                { id: editing.id, data: payload },
                {
                    onSuccess: () => { toast.success('Recipe updated'); closeDialog(); },
                    onError: async (e) => { toast.error(await apiErrorMessage(e, 'Failed to update recipe')); },
                },
            );
        } else {
            createMutation.mutate(payload, {
                onSuccess: () => { toast.success('Recipe created'); closeDialog(); },
                onError: async (e) => { toast.error(await apiErrorMessage(e, 'Failed to create recipe')); },
            });
        }
    }

    function handleDeleteConfirm() {
        if (!deleteTarget) return;
        deleteMutation.mutate(deleteTarget.id, {
            onSuccess: () => { toast.success('Recipe deleted'); setDeleteTarget(null); },
            onError: async (e) => { toast.error(await apiErrorMessage(e, 'Failed to delete recipe')); setDeleteTarget(null); },
        });
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">{isMfg ? 'Bills of Materials' : 'Recipes / BOM'}</h1>
                    <p className="text-muted-foreground mt-1">
                        {isMfg ? 'Define formulas: which raw materials produce each finished product' : 'Manage recipes and bills of materials'}
                    </p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add {docLabel}
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
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">{isMfg ? 'Unit Cost' : 'Cost/Portion'}</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">{isMfg ? 'Material Cost' : 'Suggested Price'}</th>
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
                                ) : isError ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                                            <p className="text-muted-foreground">Couldn&apos;t load recipes</p>
                                            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                        </td>
                                    </tr>
                                ) : (data?.total ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            {isMfg
                                                ? <Factory className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                                : <ChefHat className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />}
                                            <p className="text-muted-foreground">{isMfg ? 'No bills of materials yet' : 'No recipes found'}</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((recipe) => (
                                        <tr key={recipe.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-4 font-medium">{recipe.name}</td>
                                            <td className="px-6 py-4 text-muted-foreground hidden md:table-cell">
                                                {recipe.item_name || recipe.sku || '—'}
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
                                                {formatCurrency(isMfg ? recipe.total_cost : recipe.suggested_price)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title="Manage ingredients"
                                                        aria-label="Manage ingredients"
                                                        onClick={() => router.push(`/${orgSlug}/recipes/${recipe.id}`)}
                                                    >
                                                        <FlaskConical className="h-4 w-4" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => openEdit(recipe)}>
                                                        Edit
                                                    </Button>
                                                    <Button variant="ghost" size="sm" aria-label="Delete recipe" onClick={() => setDeleteTarget(recipe)}>
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
                    {!isLoading && (data?.total ?? 0) > 0 && (
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
                                        {editing ? `Edit ${docLabel}` : `Add ${docLabel}`}
                                    </h2>
                                    <button onClick={closeDialog} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">{docLabel} Name *</label>
                                        <Input
                                            placeholder={isMfg ? 'e.g. Dishwashing Liquid 750ml' : 'e.g. Margherita Pizza'}
                                            value={formName}
                                            onChange={(e) => setFormName(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">SKU</label>
                                        <Input
                                            placeholder="Auto-generated if blank"
                                            value={formSKU}
                                            onChange={(e) => setFormSKU(e.target.value)}
                                        />
                                    </div>
                                    <ItemSearchInput
                                        orgSlug={orgSlug}
                                        value={formItemName}
                                        label={isMfg ? 'Finished Product' : 'Produced Item'}
                                        placeholder={isMfg ? 'Search for the finished product...' : 'Search for produced item...'}
                                        onSelect={(item) => {
                                            setFormItemId(item.id);
                                            setFormItemName(item.name);
                                        }}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">{isMfg ? 'Output Qty (units / batch)' : 'Servings'}</label>
                                            <Input
                                                type="number"
                                                min="1"
                                                step="any"
                                                value={formServings}
                                                onChange={(e) => setFormServings(e.target.value)}
                                            />
                                        </div>
                                        {isMfg ? (
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium">Quality Control</label>
                                                <label className="flex items-center gap-2 text-sm h-9">
                                                    <input
                                                        type="checkbox"
                                                        checked={formRequiresQC}
                                                        onChange={(e) => setFormRequiresQC(e.target.checked)}
                                                    />
                                                    Requires passing QC to complete
                                                </label>
                                            </div>
                                        ) : (
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
                                        )}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {isMfg
                                            ? 'Raw materials (the BOM) can be added after creating the bill of materials.'
                                            : 'Ingredients can be managed after creating the recipe.'}
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

            <ConfirmDialog
                open={!!deleteTarget}
                title="Delete Recipe"
                description={`Delete recipe "${deleteTarget?.name}"? This cannot be undone.`}
                variant="danger"
                confirmLabel="Delete"
                onConfirm={handleDeleteConfirm}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}
