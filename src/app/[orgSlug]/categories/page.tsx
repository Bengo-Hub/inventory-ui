'use client';

import { Badge, Button, Card, CardContent, CardHeader, Input } from '@/components/ui/base';
import { Pagination } from '@/components/ui/pagination';
import { apiClient } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Tag, X } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';

const ITEMS_PER_PAGE = 20;

interface Category {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    parentName: string | null;
    depth: number;
    itemCount: number;
}

interface CategoryPayload {
    name: string;
    slug: string;
    parentId: string | null;
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
    const [formSlug, setFormSlug] = useState('');
    const [formParentId, setFormParentId] = useState('');

    const { data: categories, isLoading } = useQuery<Category[]>({
        queryKey: ['categories', orgSlug, search],
        queryFn: () => {
            const p: Record<string, string> = {};
            if (search) p.search = search;
            return apiClient.get(`/api/v1/${orgSlug}/inventory/categories`, p);
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
        onError: () => {
            toast.error(editing ? 'Failed to update category' : 'Failed to create category');
        },
    });

    const totalPages = Math.max(1, Math.ceil((categories?.length ?? 0) / ITEMS_PER_PAGE));
    const paginatedItems = categories?.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) ?? [];

    useMemo(() => { setPage(1); }, [search]);

    function slugify(value: string) {
        return value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    }

    function openCreate() {
        setEditing(null);
        setFormName('');
        setFormSlug('');
        setFormParentId('');
        setDialogOpen(true);
    }

    function openEdit(cat: Category) {
        setEditing(cat);
        setFormName(cat.name);
        setFormSlug(cat.slug);
        setFormParentId(cat.parentId ?? '');
        setDialogOpen(true);
    }

    function closeDialog() {
        setDialogOpen(false);
        setEditing(null);
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!formName.trim()) {
            toast.error('Category name is required');
            return;
        }
        mutation.mutate({
            name: formName.trim(),
            slug: formSlug.trim() || slugify(formName.trim()),
            parentId: formParentId || null,
        });
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
                    <p className="text-muted-foreground mt-1">Organize items into a hierarchy of categories</p>
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
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden md:table-cell">Slug</th>
                                    <th className="text-left px-6 py-3 font-medium text-muted-foreground hidden lg:table-cell">Parent</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Depth</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground hidden sm:table-cell">Items</th>
                                    <th className="text-right px-6 py-3 font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                                            Loading categories...
                                        </td>
                                    </tr>
                                ) : (categories?.length ?? 0) === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center">
                                            <Tag className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                                            <p className="text-muted-foreground">No categories yet</p>
                                            <p className="text-xs text-muted-foreground/70 mt-1">Create categories to organize your items</p>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedItems.map((cat) => (
                                        <tr key={cat.id} className="hover:bg-accent/30 transition-colors">
                                            <td className="px-6 py-4 font-medium">
                                                <div className="flex items-center gap-2">
                                                    {cat.depth > 0 && (
                                                        <span className="text-muted-foreground/50">{'└'.padStart(cat.depth * 2)}</span>
                                                    )}
                                                    {cat.name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-mono text-xs text-muted-foreground hidden md:table-cell">{cat.slug}</td>
                                            <td className="px-6 py-4 text-muted-foreground hidden lg:table-cell">
                                                {cat.parentName ?? <span className="text-muted-foreground/40">—</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right hidden sm:table-cell">
                                                <Badge variant="outline">{cat.depth}</Badge>
                                            </td>
                                            <td className="px-6 py-4 text-right tabular-nums hidden sm:table-cell">
                                                {cat.itemCount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Button variant="ghost" size="sm" onClick={() => openEdit(cat)}>
                                                    Edit
                                                </Button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    {!isLoading && (categories?.length ?? 0) > 0 && (
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
                                    <h2 className="text-lg font-semibold">
                                        {editing ? 'Edit Category' : 'Add Category'}
                                    </h2>
                                    <button onClick={closeDialog} className="p-1 rounded-lg hover:bg-accent transition-colors">
                                        <X className="h-5 w-5 text-muted-foreground" />
                                    </button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Name *</label>
                                        <Input
                                            placeholder="e.g. Beverages"
                                            value={formName}
                                            onChange={(e) => {
                                                setFormName(e.target.value);
                                                if (!editing) setFormSlug(slugify(e.target.value));
                                            }}
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Slug</label>
                                        <Input
                                            placeholder="auto-generated from name"
                                            value={formSlug}
                                            onChange={(e) => setFormSlug(slugify(e.target.value))}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Parent Category</label>
                                        <select
                                            value={formParentId}
                                            onChange={(e) => setFormParentId(e.target.value)}
                                            className="w-full rounded-lg border border-input bg-transparent px-4 py-2 text-sm focus:ring-1 focus:ring-ring focus:outline-none"
                                        >
                                            <option value="">None (top-level)</option>
                                            {categories?.filter((c) => c.id !== editing?.id).map((c) => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
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
