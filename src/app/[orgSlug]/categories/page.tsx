'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { apiClient } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, FolderTree, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/error-message';

const ITEMS_PER_PAGE = 20;

interface Category {
    id: string;
    name: string;
    code?: string;
    description?: string;
    icon?: string;
    parent_id?: string | null;
    parent_name?: string | null;
    is_active: boolean;
}

interface CategoryPayload {
    name: string;
    code: string;
    description: string;
    parent_id?: string | null;
}

export default function CategoriesPage() {
    const params = useParams();
    const orgSlug = params?.orgSlug as string;
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
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

    const totalPages = Math.max(1, Math.ceil(sorted.length / ITEMS_PER_PAGE));
    const paginatedItems = sorted.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

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
        mutation.mutate({
            name: formName.trim(),
            code: formCode.trim(),
            description: formDescription.trim(),
            parent_id: formParentId || null,
        });
    }

    // For parent select: exclude the category being edited (can't be its own parent)
    const parentOptions = (categories ?? []).filter((c) => !editing || c.id !== editing.id);

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
                    <p className="text-muted-foreground mt-1">Organise items into categories for easy filtering</p>
                </div>
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
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-muted/30">
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground">Name</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Code</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Parent</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Status</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading categories...
                                        </td>
                                    </tr>
                                ) : isError ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <AlertTriangle className="h-10 w-10 mx-auto text-destructive/60 mb-3" />
                                            <p className="text-muted-foreground">Couldn&apos;t load categories</p>
                                            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Retry</Button>
                                        </td>
                                    </tr>
                                ) : paginatedItems.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center">
                                            <FolderTree className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No categories defined yet</p>
                                            <p className="text-xs text-muted-foreground/70 mt-1">Add categories to organise your inventory items</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((cat) => (
                                        <tr key={cat.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-4 font-medium">
                                                {(cat as Category & { indent?: boolean }).indent && (
                                                    <span className="text-muted-foreground mr-2">└─</span>
                                                )}
                                                {cat.name}
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-muted-foreground hidden md:table-cell">
                                                {cat.code ?? <span className="text-muted-foreground/40">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-muted-foreground hidden lg:table-cell">
                                                {cat.parent_name ?? <span className="text-muted-foreground/40">Root</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right hidden sm:table-cell">
                                                <Badge variant={cat.is_active ? 'success' : 'outline'}>
                                                    {cat.is_active ? 'Active' : 'Inactive'}
                                                </Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        aria-label="Edit category"
                                                        onClick={() => openEdit(cat)}
                                                    >
                                                        <Pencil className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        aria-label="Delete category"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => handleDelete(cat)}
                                                        disabled={deleteMutation.isPending}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && sorted.length > 0 && (
                        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
                    )}
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
                                        <select
                                            value={formParentId}
                                            onChange={(e) => setFormParentId(e.target.value)}
                                            className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                        >
                                            <option value="">None (root category)</option>
                                            {parentOptions.map((c) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
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
