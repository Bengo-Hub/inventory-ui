'use client';

import { Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { apiClient } from '@/lib/api/client';
import { useCreateFromQuery } from '@/hooks/useCreateFromQuery';
import { useCategories } from '@/hooks/useCategories';
import { normalizeName } from '@/hooks/useDuplicateNameWarning';
import { useBrands, useCreateBrand, useUpdateBrand, useDeleteBrand } from '@/hooks/useBrands';
import { type Brand, type BrandPayload } from '@/lib/api/brands';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, X, Tag, Award } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';
import { SearchableCombobox } from '@bengo-hub/shared-ui-lib/combobox';
import { DataTable } from '@bengo-hub/shared-ui-lib/data-table';
import { buildCategoryColumns, type CategoryRow } from './category-columns';
import { buildBrandColumns } from './brand-columns';

export interface Category {
    id: string;
    name: string;
    code?: string;
    description?: string;
    icon?: string;
    parent_id?: string | null;
    parent_name?: string | null;
    is_active: boolean;
    created_at?: string;
}

type Tab = 'categories' | 'brands';
const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'categories', label: 'Categories', icon: Tag },
    { id: 'brands', label: 'Brands', icon: Award },
];

export default function CategoriesPage() {
    // Categories stays the default tab so the mobile quick-add flow (?create=1, handled by
    // CategoriesTab's own useCreateFromQuery) keeps opening its dialog exactly as before tabs existed.
    const [activeTab, setActiveTab] = useState<Tab>('categories');

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Categories &amp; Brands</h1>
                    <p className="text-muted-foreground mt-1">Organise items into categories and manage the brand master</p>
                </div>
            </div>

            <div className="flex gap-1 p-1 rounded-2xl bg-muted/50 border border-border overflow-x-auto scrollbar-hide w-fit">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-all
                ${active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Icon className="h-4 w-4 shrink-0" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'categories' && <CategoriesTab />}
            {activeTab === 'brands' && <BrandsTab />}
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════════════════
// Categories tab
// ══════════════════════════════════════════════════════════════════════════════

interface CategoryPayload {
    name: string;
    code: string;
    description: string;
    parent_id?: string | null;
}

function CategoriesTab() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [dialogOpen, setDialogOpen] = useState(false);
    useCreateFromQuery(() => setDialogOpen(true)); // mobile quick-add → open New Category
    const [editing, setEditing] = useState<Category | null>(null);

    const [formName, setFormName] = useState('');
    const [formCode, setFormCode] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formParentId, setFormParentId] = useState('');

    const { data: categories, isLoading, isError, refetch } = useQuery<Category[]>({
        queryKey: ['categories', orgSlug, search],
        queryFn: async () => {
            const p: Record<string, string> = {};
            if (search) p.search = search;
            const res = await apiClient.get<{ data: Category[]; total: number } | Category[]>(`/api/v1/${orgSlug}/inventory/categories`, p);
            return Array.isArray(res) ? res : (res as { data: Category[] }).data ?? [];
        },
        placeholderData: [],
    });

    // Unfiltered list for the duplicate-name check below — decoupled from the search
    // box above, which can be actively filtering the table when "Add Category" is clicked.
    const { data: allCategories } = useCategories(orgSlug);
    const normalizedFormName = normalizeName(formName);
    const isDuplicateCategory = normalizedFormName.length > 0 && (allCategories ?? []).some(
        (c) => (!editing || c.id !== editing.id) && normalizeName(c.name) === normalizedFormName,
    );

    const mutation = useMutation({
        mutationFn: (payload: CategoryPayload) =>
            editing
                ? apiClient.put(`/api/v1/${orgSlug}/inventory/categories/${editing.id}`, payload)
                : apiClient.post(`/api/v1/${orgSlug}/inventory/categories`, payload),
        onSuccess: () => {
            toast.success(editing ? 'Category updated' : 'Category created');
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            closeDialog();
        },
        onError: async (e) => {
            toast.error(await apiErrorMessage(e, editing ? 'Failed to update category' : 'Failed to create category'));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiClient.delete(`/api/v1/${orgSlug}/inventory/categories/${id}`),
        onSuccess: () => {
            toast.success('Category deleted');
            queryClient.invalidateQueries({ queryKey: ['categories'] });
        },
        onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to delete category')),
    });

    function handleDelete(cat: Category) {
        if (!confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
        deleteMutation.mutate(cat.id);
    }

    const sorted = useMemo(() => {
        if (!categories) return [];

        // Search mode: show ONLY categories matching the query (by name OR code),
        // ranked so exact matches come first, then prefix matches, then substrings.
        // The hierarchical nesting is intentionally dropped here so the matched
        // row is always surfaced at the very top instead of being buried under
        // its parent root.
        const q = search.trim().toLowerCase();
        if (q) {
            const rank = (c: Category): number => {
                const name = c.name.toLowerCase();
                const code = (c.code ?? '').toLowerCase();
                if (name === q || code === q) return 0;            // exact match
                if (name.startsWith(q) || code.startsWith(q)) return 1; // prefix match
                if (name.includes(q) || code.includes(q)) return 2;     // substring match
                return 3;                                          // no match
            };
            return categories
                .map((c) => ({ cat: c, r: rank(c) }))
                .filter(({ r }) => r < 3)
                .sort((a, b) => a.r - b.r || a.cat.name.localeCompare(b.cat.name))
                .map(({ cat }) => cat as Category & { indent?: boolean });
        }

        // Default view: root categories first, then children nested under parents.
        const roots = categories.filter((c) => !c.parent_id);
        const children = categories.filter((c) => !!c.parent_id);
        const result: Array<Category & { indent?: boolean }> = [];
        for (const root of roots) {
            result.push(root);
            for (const child of children) {
                if (child.parent_id === root.id) {
                    result.push({ ...child, indent: true });
                }
            }
        }
        // Any orphaned children (parent deleted) appended at end
        for (const child of children) {
            if (!result.find((r) => r.id === child.id)) {
                result.push({ ...child, indent: true });
            }
        }
        return result;
    }, [categories, search]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const paginatedItems = sorted.slice((page - 1) * pageSize, page * pageSize);

    useMemo(() => { setPage(1); }, [search]);

    function openCreate() {
        setEditing(null);
        setFormName('');
        setFormCode('');
        setFormDescription('');
        setFormParentId('');
        setDialogOpen(true);
    }

    function openEdit(cat: Category) {
        setEditing(cat);
        setFormName(cat.name);
        setFormCode(cat.code ?? '');
        setFormDescription(cat.description ?? '');
        setFormParentId(cat.parent_id ?? '');
        setDialogOpen(true);
    }

    function closeDialog() {
        setDialogOpen(false);
        setEditing(null);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formName.trim()) {
            toast.error('Name is required');
            return;
        }
        if (isDuplicateCategory) {
            toast.error(`A category named "${formName.trim()}" already exists`);
            return;
        }
        mutation.mutate({
            name: formName.trim(),
            code: formCode.trim(),
            description: formDescription.trim(),
            parent_id: formParentId || null,
        });
    }

    // For parent select: exclude the category being edited (can't be its own parent)
    const parentOptions = (categories ?? []).filter((c) => !editing || c.id !== editing.id);

    const columns = useMemo(
        () => buildCategoryColumns({ isDeleting: deleteMutation.isPending, onEdit: openEdit, onDelete: handleDelete }),
        [deleteMutation.isPending],
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Category
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search categories..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<CategoryRow>
                            columns={columns}
                            rows={paginatedItems}
                            rowKey={(cat) => cat.id}
                            loading={isLoading}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyText="No categories defined yet — add categories to organise your inventory items"
                            storageKey="categories-col-prefs"
                            page={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            total={sorted.length}
                            pageSize={pageSize}
                            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
                        />
                    </div>
                </CardContent>
            </Card>

            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
                    <div className="relative z-50 w-full max-w-lg mx-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">{editing ? 'Edit Category' : 'Add Category'}</h2>
                                    <button onClick={closeDialog} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Name *</label>
                                            <Input
                                                placeholder="e.g. Beverages"
                                                value={formName}
                                                onChange={(e) => setFormName(e.target.value)}
                                                required
                                            />
                                            {isDuplicateCategory && (
                                                <p className="text-xs text-destructive">A category named &quot;{formName.trim()}&quot; already exists.</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Code</label>
                                            <Input
                                                placeholder="e.g. BEV"
                                                value={formCode}
                                                onChange={(e) => setFormCode(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Parent Category</label>
                                        <SearchableCombobox
                                            options={parentOptions.map((c) => ({ value: c.id, label: c.name }))}
                                            value={formParentId}
                                            onChange={(id) => setFormParentId(id)}
                                            placeholder="None (root category)"
                                            searchPlaceholder="Search categories…"
                                        />
                                        <p className="text-xs text-muted-foreground">Optional. Assign a parent to create a subcategory.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Description</label>
                                        <textarea
                                            placeholder="Optional description..."
                                            value={formDescription}
                                            onChange={(e) => setFormDescription(e.target.value)}
                                            rows={3}
                                            className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" className="flex-1" disabled={mutation.isPending || isDuplicateCategory}>
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

// ══════════════════════════════════════════════════════════════════════════════
// Brands tab
// ══════════════════════════════════════════════════════════════════════════════

function BrandsTab() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<Brand | null>(null);

    const [formName, setFormName] = useState('');
    const [formCode, setFormCode] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formLogoUrl, setFormLogoUrl] = useState('');
    const [formSortOrder, setFormSortOrder] = useState('');

    const { data: brands, isLoading, isError, refetch } = useBrands(orgSlug);
    const createMut = useCreateBrand(orgSlug);
    const updateMut = useUpdateBrand(orgSlug);
    const deleteMut = useDeleteBrand(orgSlug);
    const isSaving = createMut.isPending || updateMut.isPending;

    const normalizedFormName = normalizeName(formName);
    const isDuplicateBrand = normalizedFormName.length > 0 && (brands ?? []).some(
        (b) => (!editing || b.id !== editing.id) && normalizeName(b.name) === normalizedFormName,
    );

    function handleDelete(brand: Brand) {
        if (!confirm(`Delete brand "${brand.name}"? This cannot be undone.`)) return;
        deleteMut.mutate(brand.id, {
            onSuccess: () => toast.success('Brand deleted'),
            onError: async (e) => toast.error(await apiErrorMessage(e, 'Failed to delete brand')),
        });
    }

    const sorted = useMemo(() => {
        if (!brands) return [];
        const q = search.trim().toLowerCase();
        if (!q) return [...brands].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
        const rank = (b: Brand): number => {
            const name = b.name.toLowerCase();
            const code = (b.code ?? '').toLowerCase();
            if (name === q || code === q) return 0;
            if (name.startsWith(q) || code.startsWith(q)) return 1;
            if (name.includes(q) || code.includes(q)) return 2;
            return 3;
        };
        return brands
            .map((b) => ({ b, r: rank(b) }))
            .filter(({ r }) => r < 3)
            .sort((a, b) => a.r - b.r || a.b.name.localeCompare(b.b.name))
            .map(({ b }) => b);
    }, [brands, search]);

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
    const paginatedItems = sorted.slice((page - 1) * pageSize, page * pageSize);

    useMemo(() => { setPage(1); }, [search]);

    function openCreate() {
        setEditing(null);
        setFormName('');
        setFormCode('');
        setFormDescription('');
        setFormLogoUrl('');
        setFormSortOrder('');
        setDialogOpen(true);
    }

    function openEdit(brand: Brand) {
        setEditing(brand);
        setFormName(brand.name);
        setFormCode(brand.code ?? '');
        setFormDescription(brand.description ?? '');
        setFormLogoUrl(brand.logo_url ?? '');
        setFormSortOrder(brand.sort_order ? String(brand.sort_order) : '');
        setDialogOpen(true);
    }

    function closeDialog() {
        setDialogOpen(false);
        setEditing(null);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formName.trim()) {
            toast.error('Name is required');
            return;
        }
        if (isDuplicateBrand) {
            toast.error(`A brand named "${formName.trim()}" already exists`);
            return;
        }
        const payload: BrandPayload = {
            name: formName.trim(),
            code: formCode.trim() || undefined,
            description: formDescription.trim() || undefined,
            logo_url: formLogoUrl.trim() || undefined,
            sort_order: formSortOrder.trim() ? parseInt(formSortOrder, 10) || 0 : undefined,
        };
        const onSuccess = () => {
            toast.success(editing ? 'Brand updated' : 'Brand created');
            closeDialog();
        };
        const onError = async (e: unknown) => toast.error(await apiErrorMessage(e, editing ? 'Failed to update brand' : 'Failed to create brand'));
        if (editing) {
            updateMut.mutate({ id: editing.id, data: payload }, { onSuccess, onError });
        } else {
            createMut.mutate(payload, { onSuccess, onError });
        }
    }

    const columns = useMemo(
        () => buildBrandColumns({ isDeleting: deleteMut.isPending, onEdit: openEdit, onDelete: handleDelete }),
        [deleteMut.isPending],
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-end">
                <Button onClick={openCreate}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Brand
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search brands..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="px-2 pb-2">
                        <DataTable<Brand>
                            columns={columns}
                            rows={paginatedItems}
                            rowKey={(b) => b.id}
                            loading={isLoading}
                            error={isError}
                            onRetry={() => refetch()}
                            emptyText="No brands defined yet — add brands to tag your GOODS items (e.g. HP, Samsung)"
                            storageKey="brands-col-prefs"
                            page={page}
                            totalPages={totalPages}
                            onPageChange={setPage}
                            total={sorted.length}
                            pageSize={pageSize}
                            onPageSizeChange={(n) => { setPageSize(n); setPage(1); }}
                        />
                    </div>
                </CardContent>
            </Card>

            {dialogOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={closeDialog} />
                    <div className="relative z-50 w-full max-w-lg mx-4">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <h2 className="text-lg font-semibold">{editing ? 'Edit Brand' : 'Add Brand'}</h2>
                                    <button onClick={closeDialog} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Name *</label>
                                            <Input
                                                placeholder="e.g. HP"
                                                value={formName}
                                                onChange={(e) => setFormName(e.target.value)}
                                                required
                                                autoFocus
                                            />
                                            {isDuplicateBrand && (
                                                <p className="text-xs text-destructive">A brand named &quot;{formName.trim()}&quot; already exists.</p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Code</label>
                                            <Input
                                                placeholder="Auto from name"
                                                value={formCode}
                                                onChange={(e) => setFormCode(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Logo URL</label>
                                            <Input
                                                placeholder="https://…"
                                                value={formLogoUrl}
                                                onChange={(e) => setFormLogoUrl(e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium">Sort Order</label>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                value={formSortOrder}
                                                onChange={(e) => setFormSortOrder(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Description</label>
                                        <textarea
                                            placeholder="Optional description..."
                                            value={formDescription}
                                            onChange={(e) => setFormDescription(e.target.value)}
                                            rows={3}
                                            className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none resize-none"
                                        />
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <Button type="button" variant="outline" className="flex-1" onClick={closeDialog}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" className="flex-1" disabled={isSaving || isDuplicateBrand}>
                                            {isSaving ? 'Saving...' : editing ? 'Update' : 'Create'}
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
